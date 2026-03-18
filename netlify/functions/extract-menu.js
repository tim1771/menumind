const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Security: max sizes to prevent prompt injection and runaway API cost
const MAX_TEXT_LENGTH = 20000;   // ~5 dense menu pages in text
const MAX_IMAGE_B64_LENGTH = 8 * 1024 * 1024; // ~6MB raw file becomes ~8MB base64

// Security: only accept requests from the same origin (our own frontend)
const ALLOWED_ORIGIN = process.env.SITE_URL || "";

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  // Security: reject requests from unexpected origins when SITE_URL is configured
  if (ALLOWED_ORIGIN) {
    const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || "";
    if (origin && !origin.startsWith(ALLOWED_ORIGIN)) {
      return { statusCode: 403, body: JSON.stringify({ error: "Forbidden" }) };
    }
  }

  let body;
  try {
    // Security: guard against malformed or missing body before any further processing
    if (!event.body) {
      return { statusCode: 400, body: JSON.stringify({ error: "Request body is required" }) };
    }
    body = JSON.parse(event.body);
  } catch (_) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  try {
    const { image, menuText } = body;

    // If raw text was provided, skip vision and structure it directly
    if (menuText && !image) {
      // Security: cap text length to prevent oversized prompts / prompt injection
      if (typeof menuText !== "string") {
        return { statusCode: 400, body: JSON.stringify({ error: "menuText must be a string" }) };
      }
      if (menuText.length > MAX_TEXT_LENGTH) {
        return { statusCode: 400, body: JSON.stringify({ error: "Menu text is too long. Maximum 20,000 characters." }) };
      }

      const textResponse = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `You are a menu data extraction specialist. Parse the provided restaurant menu text into structured JSON.

Return ONLY a JSON object (no markdown, no explanation) with this structure:
{
  "items": [
    {
      "name": "Item Name",
      "description": "Description if present, empty string if not",
      "price": 12.99,
      "category": "Category/Section name"
    }
  ]
}

Rules:
- Extract every menu item with its price
- Group items by their menu section/category
- If a price is missing, set it to 0
- If a description is missing, set it to ""
- Normalize prices to numbers (no $ signs)`
          },
          {
            role: "user",
            content: menuText
          }
        ],
        temperature: 0.1,
        max_tokens: 4000
      });

      const parsed = extractJSON(textResponse.choices[0].message.content);
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed)
      };
    }

    // Vision extraction from image
    if (!image) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Provide either an image or menu text" })
      };
    }

    // Security: validate the image is a base64 data URL and within size limits
    if (typeof image !== "string") {
      return { statusCode: 400, body: JSON.stringify({ error: "image must be a string" }) };
    }
    if (!image.startsWith("data:image/")) {
      return { statusCode: 400, body: JSON.stringify({ error: "image must be a base64 data URL" }) };
    }
    if (image.length > MAX_IMAGE_B64_LENGTH) {
      return { statusCode: 400, body: JSON.stringify({ error: "Image is too large. Maximum ~6MB." }) };
    }

    const visionResponse = await groq.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract every item from this restaurant menu image. Return ONLY a JSON object (no markdown, no explanation) with this structure:
{
  "items": [
    {
      "name": "Item Name",
      "description": "Description if visible, empty string if not",
      "price": 12.99,
      "category": "Category/Section name"
    }
  ]
}

Rules:
- Extract ALL menu items with prices
- Group by section/category as shown on the menu
- Normalize prices to numbers (no $ signs)
- If a price is unclear, estimate based on context or set to 0
- If description is not visible, set to ""`
            },
            {
              type: "image_url",
              image_url: { url: image }
            }
          ]
        }
      ],
      temperature: 0.1,
      max_tokens: 4000
    });

    const parsed = extractJSON(visionResponse.choices[0].message.content);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed)
    };

  } catch (err) {
    // Security: log full error server-side only, never return internal details to callers
    console.error("Extract menu error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to extract menu data. Please try again." })
    };
  }
};

function extractJSON(text) {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch (_) {}

  // Try to find JSON in the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (_) {}
  }

  throw new Error("Could not parse AI response as JSON");
}
