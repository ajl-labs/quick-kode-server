import { ContentListUnion, GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.MY_GOOGLE_GEMINI_API_KEY!,
});

export const runGemini = async (
  systemInstruction: string,
  contents: ContentListUnion
) => {
  try {
    const response = await ai.models.generateContent({
      // 1. Corrected model name
      model: "gemini-2.0-flash",
      contents,
      config: {
        thinkingConfig: {
          thinkingBudget: 0,
        },
        systemInstruction,
      },
    });

    // 2. Check if the response was blocked or is empty
    if (
      !response.candidates ||
      response.candidates.length === 0 ||
      !response.candidates[0].content
    ) {
      console.error("The response was blocked by the API.");
      // 3. Log the safety feedback to understand WHY it was blocked
      console.log(
        "Block Reason:",
        JSON.stringify(response.promptFeedback, null, 2)
      );
      throw new Error(
        "Response was blocked due to safety concerns. Check server logs for details."
      );
    }

    // If successful, return the text from the first candidate
    return response.candidates?.[0].content.parts;
  } catch (error) {
    console.error("An error occurred during the Gemini API call:", error);
    throw new Error("Failed to fetch response from the API.");
  }
};
