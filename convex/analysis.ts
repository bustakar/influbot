'use node';

import { v } from 'convex/values';
import { internalAction } from './_generated/server';

interface AnalysisResponse {
  scores: {
    voiceClarity: number;
    posture: number;
    eyeContact: number;
    fluency: number;
    confidence: number;
  };
  feedback: string;
}

/**
 * Parse AI response to extract structured analysis results.
 */
function parseAnalysisResponse(responseText: string): AnalysisResponse {
  // Try to extract JSON from the response
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.scores && parsed.feedback) {
        return {
          scores: {
            voiceClarity: parsed.scores.voiceClarity ?? 0,
            posture: parsed.scores.posture ?? 0,
            eyeContact: parsed.scores.eyeContact ?? 0,
            fluency: parsed.scores.fluency ?? 0,
            confidence: parsed.scores.confidence ?? 0,
          },
          feedback: parsed.feedback,
        };
      }
    } catch (e) {
      // Fall through to default parsing
    }
  }

  // Fallback: extract scores from text and create structured response
  const scores = {
    voiceClarity: extractScore(responseText, 'voice clarity', 'voice'),
    posture: extractScore(responseText, 'posture', 'stance'),
    eyeContact: extractScore(responseText, 'eye contact', 'eye'),
    fluency: extractScore(responseText, 'fluency', 'fluent'),
    confidence: extractScore(responseText, 'confidence', 'confident'),
  };

  return {
    scores,
    feedback: responseText,
  };
}

/**
 * Extract a score (0-100) from text based on keywords.
 */
function extractScore(
  text: string,
  primaryKeyword: string,
  secondaryKeyword: string
): number {
  const lowerText = text.toLowerCase();
  const keywords = [primaryKeyword, secondaryKeyword];

  for (const keyword of keywords) {
    // Look for patterns like "voice clarity: 85" or "85/100"
    const regex = new RegExp(`${keyword}[^0-9]*([0-9]{1,3})(?:/100)?`, 'i');
    const match = lowerText.match(regex);
    if (match) {
      const score = parseInt(match[1], 10);
      return Math.min(100, Math.max(0, score));
    }
  }

  // Default score if not found
  return 50;
}

/**
 * Build the analysis prompt with user's custom focus areas.
 */
function buildAnalysisPrompt(customPrompt: string, dayNumber: number): string {
  return `You are analyzing a video recording for a 30-day speaking improvement challenge. This is day ${dayNumber} of the challenge.

User's specific focus areas: ${customPrompt}

Analyze the video and provide:
1. Scores (0-100) for each metric:
   - voiceClarity: How clear and audible is the speech?
   - posture: How is the body posture and stance?
   - eyeContact: How well does the person maintain eye contact with the camera?
   - fluency: How fluent and smooth is the speech?
   - confidence: How confident does the person appear?

2. Detailed feedback: Provide constructive feedback focusing on the user's specific areas of improvement mentioned above.

Respond in JSON format:
{
  "scores": {
    "voiceClarity": <number>,
    "posture": <number>,
    "eyeContact": <number>,
    "fluency": <number>,
    "confidence": <number>
  },
  "feedback": "<detailed feedback text>"
}`;
}

/**
 * Analyze video using OpenRouter (Gemini model) with custom prompt.
 */
export const analyzeVideo = internalAction({
  args: {
    videoUrl: v.string(),
    customPrompt: v.string(),
    dayNumber: v.number(),
  },
  returns: v.object({
    scores: v.object({
      voiceClarity: v.number(),
      posture: v.number(),
      eyeContact: v.number(),
      fluency: v.number(),
      confidence: v.number(),
    }),
    feedback: v.string(),
  }),
  handler: async (ctx, args) => {
    console.log('[analyzeVideo] Starting video analysis:', {
      videoUrl: args.videoUrl.substring(0, 100) + '...',
      dayNumber: args.dayNumber,
      customPromptLength: args.customPrompt.length,
    });

    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      console.error('[analyzeVideo] OPENROUTER_API_KEY not set');
      throw new Error('OPENROUTER_API_KEY must be set');
    }

    const prompt = buildAnalysisPrompt(args.customPrompt, args.dayNumber);
    console.log('[analyzeVideo] Built analysis prompt, length:', prompt.length);

    const requestBody = {
      model: 'google/gemini-1.5-pro',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `${prompt}\n\nVideo URL: ${args.videoUrl}`,
            },
          ],
        },
      ],
      max_tokens: 1000,
    };

    console.log('[analyzeVideo] Making request to OpenRouter:', {
      url: 'https://openrouter.ai/api/v1/chat/completions',
      model: requestBody.model,
      messageLength: requestBody.messages[0].content[0].text.length,
    });

    // Use Gemini 1.5 Pro which supports video analysis
    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey.substring(0, 10)}...`,
          'Content-Type': 'application/json',
          'HTTP-Referer':
            process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
          'X-Title': '30-Day Video Challenge',
        },
        body: JSON.stringify(requestBody),
      }
    );

    console.log('[analyzeVideo] Response status:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[analyzeVideo] Error response:', errorText);
      throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
    }

    const responseText = await response.text();
    console.log(
      '[analyzeVideo] Response body (first 500 chars):',
      responseText.substring(0, 500)
    );

    const data = JSON.parse(responseText) as {
      choices: Array<{
        message: {
          content: string;
        };
      }>;
    };

    const content = data.choices[0]?.message?.content;
    if (!content) {
      console.error('[analyzeVideo] No content in response:', data);
      throw new Error('No content in AI response');
    }

    console.log('[analyzeVideo] Got AI response, length:', content.length);
    console.log('[analyzeVideo] Parsing analysis response...');

    const parsed = parseAnalysisResponse(content);
    console.log('[analyzeVideo] Parsed analysis:', {
      scores: parsed.scores,
      feedbackLength: parsed.feedback.length,
    });

    return parsed;
  },
});
