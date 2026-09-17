/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, Type, Modality } from "@google/genai";
import { RepoFileTree, Citation, ArchitectureAuditReport } from '../types';

export const getGeminiApiKey = (): string => {
  // 1. Check LocalStorage (user entered key in UI or standalone deployment)
  if (typeof window !== 'undefined') {
    const customKey = localStorage.getItem('gemini_api_key') || localStorage.getItem('user_gemini_api_key');
    if (customKey && customKey.trim()) return customKey.trim();
  }
  
  // 2. Check process.env (AI Studio container injected key)
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.API_KEY && process.env.API_KEY !== 'PLACEHOLDER_API_KEY') {
      return process.env.API_KEY;
    }
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'PLACEHOLDER_API_KEY') {
      return process.env.GEMINI_API_KEY;
    }
  }

  // 3. Check Vite import.meta.env
  try {
    if (import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) {
      return import.meta.env.VITE_GEMINI_API_KEY;
    }
  } catch (e) {}

  return '';
};

// Helper to ensure we always get the freshest key dynamically
const getAiClient = () => {
  const apiKey = getGeminiApiKey();
  return new GoogleGenAI({ apiKey });
};

export interface InfographicResult {
    imageData: string | null;
    citations: Citation[];
}

export function formatRepoAnalysisContext(fileTree: RepoFileTree[], maxPaths: number = 150): string {
  // 1. File Tree Structure
  const treeList = fileTree
    .filter(f => f.path !== '__BUILT_DEPLOYED_OUTPUT__')
    .slice(0, maxPaths)
    .map(f => f.path)
    .join('\n');

  // 2. Actual Key File Contents
  const filesWithContent = fileTree.filter(f => 
    f.path !== '__BUILT_DEPLOYED_OUTPUT__' && f.content && f.content.trim().length > 0
  );

  let fileContentsSection = "";
  if (filesWithContent.length > 0) {
    fileContentsSection = "\n\n=== ACTUAL KEY FILE CONTENTS ===\n" + 
      filesWithContent.map(f => `--- FILE: ${f.path} ---\n${f.content?.slice(0, 3000)}`).join('\n\n');
  }

  // 3. Live Built / Deployed Site Output
  const builtOutputItem = fileTree.find(f => f.path === '__BUILT_DEPLOYED_OUTPUT__');
  let builtOutputSection = "";
  if (builtOutputItem && builtOutputItem.content) {
    builtOutputSection = "\n\n=== LIVE BUILT / DEPLOYED SITE OUTPUT ===\n" + builtOutputItem.content;
  }

  return `REPOSITORY FILE TREE STRUCTURE (${Math.min(fileTree.length, maxPaths)} files):\n${treeList}${fileContentsSection}${builtOutputSection}`;
}

export async function generateInfographic(
  repoName: string, 
  fileTree: RepoFileTree[], 
  style: string, 
  is3D: boolean = false,
  language: string = "English"
): Promise<string | null> {
  const ai = getAiClient();
  const repoContext = formatRepoAnalysisContext(fileTree, 150);
  
  let styleGuidelines = "";
  let dimensionPrompt = "";

  if (is3D) {
      // OVERRIDE standard styles for a specific "Tabletop Model" look
      styleGuidelines = `VISUAL STYLE: Photorealistic Miniature Diorama. The data flow should look like a complex, glowing 3D printed physical model sitting on a dark, reflective executive desk.`;
      dimensionPrompt = `PERSPECTIVE & RENDER: Isometric view with TILT-SHIFT depth of field (blurry foreground/background) to make it look like a small, tangible object on a table. Cinematic volumetric lighting. Highly detailed, 'octane render' style.`;
  } else {
      // Standard 2D styles or Custom
      switch (style) {
          case "Hand-Drawn Blueprint":
              styleGuidelines = `VISUAL STYLE: Technical architectural blueprint. Dark blue background with white/light blue hand-drawn lines. Looks like a sketch on drafting paper.`;
              break;
          case "Corporate Minimal":
              styleGuidelines = `VISUAL STYLE: Clean, corporate, minimalist. White background, lots of whitespace. Use a limited, professional color palette (greys, navy blues).`;
              break;
          case "Neon Cyberpunk":
              styleGuidelines = `VISUAL STYLE: Dark mode cyberpunk. Black background with glowing neon pink, cyan, and violet lines and nodes. High contrast, futuristic look.`;
              break;
          case "Modern Data Flow":
              styleGuidelines = `VISUAL STYLE: Replicate "Androidify Data Flow" aesthetic. Light blue (#eef8fe) solid background. Colorful, flat vector icons. Smooth, bright blue curved arrows.`;
              break;
          default:
              // Handle custom style string
              if (style && style !== "Custom") {
                  styleGuidelines = `VISUAL STYLE: ${style}.`;
              } else {
                  styleGuidelines = `VISUAL STYLE: Replicate "Androidify Data Flow" aesthetic. Light blue (#eef8fe) solid background. Colorful, flat vector icons. Smooth, bright blue curved arrows.`;
              }
              break;
      }
      dimensionPrompt = "Perspective: Clean 2D flat diagrammatic view straight-on. No 3D effects.";
  }

  const baseStylePrompt = `
  STRICT VISUAL STYLE GUIDELINES:
  ${styleGuidelines}
  - LAYOUT: Distinct Left-to-Right flow.
  - CENTRAL CONTAINER: Group core logic inside a clearly defined central area.
  - ICONS: Use relevant technical icons (databases, servers, code files, users).
  - TYPOGRAPHY: Highly readable technical font. Text MUST be in ${language}.
  `;

  const prompt = `Create a highly detailed technical logical data flow diagram infographic for GitHub repository : "${repoName}".
  
  ${baseStylePrompt}
  ${dimensionPrompt}
  
  Codebase Context & File Contents:
  ${repoContext}
  
  Diagram Content Requirements:
  1. Title exactly: "${repoName} Data Flow" (Translated to ${language} if not English)
  2. Visually map the data flow based on the actual file contents, dependencies, and structure provided.
  3. Ensure the "Input -> Processing -> Output" structure is clear.
  4. Add short, clear text labels to connecting arrows indicating data type (e.g., "JSON", "Auth Token").
  5. IMPORTANT: All text labels and explanations in the image must be written in ${language}.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return part.inlineData.data;
        }
      }
    }
    return null;
  } catch (error) {
    console.error("Gemini infographic generation failed:", error);
    throw error;
  }
}

export async function askRepoQuestion(question: string, infographicBase64: string, fileTree: RepoFileTree[]): Promise<string> {
  const ai = getAiClient();
  const repoContext = formatRepoAnalysisContext(fileTree, 300);
  
  const prompt = `You are a senior software architect reviewing a project.
  
  Attached is an architectural infographic of the project.
  Here is the actual codebase context (file structure, key file contents, and deployed output):
  ${repoContext}
  
  User Question: "${question}"
  
  Using BOTH the visual infographic and the codebase context as context, answer the user's question. 
  If they ask about optimization, suggest specific areas based on the code, dependencies, and architecture.
  Keep answers concise, technical, and helpful.`;

  try {
    const response = await ai.models.generateContent({
       model: 'gemini-3.6-flash',
       contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: infographicBase64
            }
          },
          { text: prompt }
        ]
      }
    });

    return response.text || "I couldn't generate an answer at this time.";
  } catch (error) {
    console.error("Gemini Q&A failed:", error);
    throw error;
  }
}

export async function askNodeSpecificQuestion(
  nodeLabel: string, 
  question: string, 
  fileTree: RepoFileTree[]
): Promise<string> {
  const ai = getAiClient();
  const repoContext = formatRepoAnalysisContext(fileTree, 200);
  
  const prompt = `You are a senior software architect analyzing a repository.
  
  The user is asking about a specific node in the dependency graph labeled: "${nodeLabel}".
  
  Repository Codebase & Deployed Context:
  ${repoContext}
  
  User Question: "${question}"
  
  Based on the node name "${nodeLabel}", the file structure, and actual file contents, explain what this component likely does, its responsibilities, and answer the specific question.
  Keep the response technical, concise, and helpful for a developer.`;

  try {
    const response = await ai.models.generateContent({
       model: 'gemini-3.6-flash',
       contents: {
        parts: [
          { text: prompt }
        ]
      }
    });

    return response.text || "I couldn't generate an answer at this time.";
  } catch (error) {
    console.error("Gemini Node Q&A failed:", error);
    throw error;
  }
}

export async function generateArticleInfographic(
  source: string, 
  style: string, 
  onProgress?: (stage: string) => void,
  language: string = "English"
): Promise<InfographicResult> {
    const ai = getAiClient();
    // PHASE 1: Content Understanding & Structural Breakdown (The "Planner")
    if (onProgress) onProgress("RESEARCHING & ANALYZING CONTENT...");
    
    let structuralSummary = "";
    let citations: Citation[] = [];
    const isUrl = source.startsWith('http://') || source.startsWith('https://');

    try {
        const analysisPrompt = `You are an expert Information Designer. Your goal is to extract the essential structure from ${isUrl ? 'a web page' : 'the provided document / text content'} to create a clear, educational infographic.

        ${isUrl ? `Analyze the content at this URL: ${source}` : `Analyze the provided document text:\n\n${source.slice(0, 20000)}`}
        
        TARGET LANGUAGE: ${language}.
        
        Provide a structured breakdown specifically designed for visual representation in ${language}:
        1. INFOGRAPHIC HEADLINE: The core topic in 5 words or less (in ${language}).
        2. KEY TAKEAWAYS: The 3 to 5 most important distinct points, steps, or facts (in ${language}). THESE WILL BE THE MAIN SECTIONS OF THE IMAGE.
        3. SUPPORTING DATA: Any specific numbers, percentages, or very short quotes that add credibility.
        4. VISUAL METAPHOR IDEA: Suggest ONE simple visual concept that best fits this content (e.g., "a roadmap with milestones", "a funnel", "three contrasting pillars", "a circular flowchart").
        
        Keep the output concise and focused purely on what should be ON the infographic. Ensure all content is in ${language}.`;

        const configObj: any = {};
        if (isUrl) {
          configObj.tools = [{ googleSearch: {} }];
        }

        const analysisResponse = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: analysisPrompt,
            config: configObj
        });
        structuralSummary = analysisResponse.text || "";

        // Extract citations from grounding metadata if available
        const chunks = analysisResponse.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (chunks) {
            chunks.forEach((chunk: any) => {
                if (chunk.web?.uri) {
                    citations.push({
                        uri: chunk.web.uri,
                        title: chunk.web.title || ""
                    });
                }
            });
            const uniqueCitations = new Map();
            citations.forEach(c => uniqueCitations.set(c.uri, c));
            citations = Array.from(uniqueCitations.values());
        }

    } catch (e) {
        console.warn("Content analysis failed, falling back to direct prompt", e);
        structuralSummary = `Create an infographic about: ${source.slice(0, 500)}. Translate text to ${language}.`;
    }

    // PHASE 2: Visual Synthesis (The "Artist")
    if (onProgress) onProgress("DESIGNING & RENDERING INFOGRAPHIC...");

    let styleGuidelines = "";
    switch (style) {
        case "Fun & Playful":
            styleGuidelines = `STYLE: Fun, playful, vibrant 2D vector illustrations. Use bright colors, rounded shapes, and a friendly tone.`;
            break;
        case "Clean Minimalist":
            styleGuidelines = `STYLE: Ultra-minimalist. Lots of whitespace, thin lines, limited color palette (1-2 accent colors max). Very sophisticated and airy.`;
            break;
        case "Dark Mode Tech":
            styleGuidelines = `STYLE: Dark mode technical aesthetic. Dark slate/black background with bright, glowing accent colors (cyan, lime green) for data points.`;
            break;
        case "Modern Editorial":
            styleGuidelines = `STYLE: Modern, flat vector illustration style. Clean, professional, and editorial (like a high-end tech magazine). Cohesive, mature color palette.`;
            break;
        default:
            // Custom style logic
             if (style && style !== "Custom") {
                styleGuidelines = `STYLE: Custom User Style: "${style}".`;
             } else {
                styleGuidelines = `STYLE: Modern, flat vector illustration style. Clean, professional, and editorial (like a high-end tech magazine). Cohesive, mature color palette.`;
             }
            break;
    }

    const imagePrompt = `Create a professional, high-quality educational infographic based strictly on this structured content plan:

    ${structuralSummary}

    VISUAL DESIGN RULES:
    - ${styleGuidelines}
    - LANGUAGE: The text within the infographic MUST be written in ${language}.
    - LAYOUT: MUST follow the "VISUAL METAPHOR IDEA" from the plan above if one was provided.
    - TYPOGRAPHY: Clean, highly readable sans-serif fonts. The "INFOGRAPHIC HEADLINE" must be prominent at the top.
    - CONTENT: Use the actual text from "KEY TAKEAWAYS" in the image. Do not use placeholder text like Lorem Ipsum.
    - GOAL: The image must be informative and readable as a standalone graphic.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-image',
            contents: {
                parts: [{ text: imagePrompt }],
            },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        let imageData = null;
        const parts = response.candidates?.[0]?.content?.parts;
        if (parts) {
            for (const part of parts) {
                if (part.inlineData && part.inlineData.data) {
                    imageData = part.inlineData.data;
                    break;
                }
            }
        }
        return { imageData, citations };
    } catch (error) {
        console.error("Article infographic generation failed:", error);
        throw error;
    }
}

export async function editImageWithGemini(base64Data: string, mimeType: string, prompt: string): Promise<string | null> {
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return part.inlineData.data;
        }
      }
    }
    return null;
  } catch (error) {
    console.error("Gemini image editing failed:", error);
    throw error;
  }
}

export async function analyzeRepoArchitectureWithAgent(
  repoName: string,
  fileTree: RepoFileTree[],
  language: string = "English"
): Promise<ArchitectureAuditReport> {
  const ai = getAiClient();
  const repoContext = formatRepoAnalysisContext(fileTree, 300);

  const prompt = `You are a Senior Principal Software Architect and DevOps Consultant acting as an intelligent AI Architecture Agent.
Analyze the architecture, dependencies, actual source code, and deployment layout of the repository "${repoName}".

Repository Codebase & Deployed Context:
${repoContext}

Target Language for all explanations and descriptions: ${language}.

Your Goal:
1. Assign an Architecture Health Score (0-100) reflecting structure, best practices, security, testing, modularity, and deployment readiness.
2. Provide a clear 2-3 sentence executive summary of current architectural strengths and weaknesses based on actual code and configuration.
3. Identify MISSING STRUCTURES: Critical architectural pieces, files, or folders that are absent (e.g. tests, CI/CD workflows, error handling boundaries, rate limiting, env schema validation, Docker setup, docs).
4. Suggest RECOMMENDED ADD-ONS: Architectural additions or modern upgrades that would improve scale, security, observability, or performance (e.g. Redis caching layer, OpenAPI/Swagger docs, WebSocket realtime channel, structured logging, telemetry, security headers).
5. Provide a 3-5 step prioritized Action Plan for developer implementation.

Make sure every missing structure and suggested add-on includes a concrete, production-ready solution blueprint snippet or configuration code block.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            healthSummary: { type: Type.STRING },
            missingStructures: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  category: { type: Type.STRING },
                  severity: { type: Type.STRING },
                  description: { type: Type.STRING },
                  recommendedLocation: { type: Type.STRING },
                  solutionBlueprint: { type: Type.STRING }
                },
                required: ['title', 'category', 'severity', 'description', 'solutionBlueprint']
              }
            },
            suggestedAddons: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  category: { type: Type.STRING },
                  impact: { type: Type.STRING },
                  description: { type: Type.STRING },
                  implementationGuide: { type: Type.STRING },
                  suggestedFiles: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ['title', 'category', 'impact', 'description', 'implementationGuide']
              }
            },
            actionPlan: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ['score', 'healthSummary', 'missingStructures', 'suggestedAddons', 'actionPlan']
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Architecture Agent.");
    return JSON.parse(text) as ArchitectureAuditReport;
  } catch (error) {
    console.error("Gemini Architecture Agent analysis failed:", error);
    throw error;
  }
}

export async function askArchitectureAgentFollowup(
  question: string,
  auditReport: ArchitectureAuditReport,
  repoName: string,
  fileTree: RepoFileTree[],
  language: string = "English"
): Promise<string> {
  const ai = getAiClient();
  const repoContext = formatRepoAnalysisContext(fileTree, 200);

  const prompt = `You are the AI Architecture Agent for the repository "${repoName}".
  
  Current Audit Summary:
  - Health Score: ${auditReport.score}/100
  - Executive Summary: ${auditReport.healthSummary}
  - Identified Missing Structures: ${auditReport.missingStructures.map(m => m.title).join(', ')}
  - Suggested Add-ons: ${auditReport.suggestedAddons.map(a => a.title).join(', ')}

  Codebase & Deployed Context:
  ${repoContext}

  Developer Question: "${question}"
  Target Language: ${language}

  Answer the developer's question directly, providing practical architectural guidance, step-by-step code/configuration snippets, or explanations of how to integrate the suggested add-ons or fix missing structures based on the actual codebase. Keep tone professional, authoritative, and helpful.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt
    });

    return response.text || "No response generated by the Architecture Agent.";
  } catch (error) {
    console.error("Architecture Agent Q&A failed:", error);
    throw error;
  }
}
