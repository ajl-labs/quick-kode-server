export const cleanAndParseJson = (apiResponse: string) => {
  // A regular expression to find the JSON content inside the markdown block
  const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
  const match = apiResponse.match(jsonRegex);

  // If a match is found, use the content inside the block
  const jsonString = match ? match[1] : apiResponse;

  try {
    // Parse the cleaned string into a JavaScript object
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Failed to parse JSON:", error);
    // Handle cases where the string is not valid JSON
    return null;
  }
};
