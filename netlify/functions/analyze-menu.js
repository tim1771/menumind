const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Security: hard limits to prevent prompt injection and runaway API cost
const MAX_ITEMS = 200;
const MAX_FIELD_LENGTH = 300; // per item field
const MAX_ZIP_LENGTH = 10;
const BATCH_SIZE = 20; // items per LLM call for detailed analysis
const ALLOWED_FOOD_COST_VALUES = ["25", "28", "30", "32", "35"];
// Allowlist matches the <select> options in the frontend
const ALLOWED_CUISINE_TYPES = [
  "American","Italian","Mexican","Chinese","Japanese","Thai","Indian",
  "Mediterranean","French","BBQ","Seafood","Pizza","Burger","Cafe",
  "Diner","Vegan","Fusion","Other",""
];

// Security: only accept requests from the same origin (our own frontend)
const ALLOWED_ORIGIN = process.env.SITE_URL || "";

// Security: strip characters commonly used in prompt injection before they enter the LLM prompt
function sanitizeField(value, maxLen) {
  if (typeof value !== "string") return "";
  return value.replace(/[`<>]/g, "").slice(0, maxLen);
}

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
    if (!event.body) {
      return { statusCode: 400, body: JSON.stringify({ error: "Request body is required" }) };
    }
    body = JSON.parse(event.body);
  } catch (_) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  try {
    let { items, cuisineType, zipCode, monthlyCovers, foodCostTarget } = body;

    if (!items || !Array.isArray(items) || !items.length) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No menu items provided" })
      };
    }

    if (items.length > MAX_ITEMS) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `Too many items. Maximum ${MAX_ITEMS} items per analysis.` })
      };
    }

    // Security: validate and sanitize metadata fields
    if (!ALLOWED_CUISINE_TYPES.includes(cuisineType)) {
      cuisineType = "Other";
    }
    zipCode = typeof zipCode === "string" ? zipCode.replace(/[^A-Za-z0-9 \-]/g, "").slice(0, MAX_ZIP_LENGTH) : "";
    monthlyCovers = parseInt(monthlyCovers, 10);
    if (isNaN(monthlyCovers) || monthlyCovers < 0) monthlyCovers = null;
    if (!ALLOWED_FOOD_COST_VALUES.includes(String(foodCostTarget))) {
      foodCostTarget = "30";
    }

    // Security: sanitize every item field
    const sanitizedItems = items.map(item => ({
      name: sanitizeField(item.name, MAX_FIELD_LENGTH) || "Unknown",
      price: isNaN(parseFloat(item.price)) ? "0" : String(parseFloat(item.price)),
      category: sanitizeField(item.category, MAX_FIELD_LENGTH) || "Uncategorized",
      description: sanitizeField(item.description, MAX_FIELD_LENGTH)
    }));

    const menuItemsList = sanitizedItems.map(item =>
      `- ${item.name} | $${item.price} | ${item.category} | "${item.description}"`
    ).join("\n");

    const restaurantContext = `RESTAURANT DETAILS:
- Cuisine: ${cuisineType || "Not specified"}
- Location (ZIP/Postal): ${zipCode || "Not specified"}
- Monthly covers (customers): ${monthlyCovers !== null ? monthlyCovers : "Not specified"}
- Target food cost %: ${foodCostTarget}%`;

    // STEP 1: Get overview — summary, matrix, insights
    const overviewResponse = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `You are an elite restaurant menu engineering consultant. Analyze the menu and return a high-level audit.

IMPORTANT: Return ONLY a valid JSON object. No markdown fences, no explanation.

{
  "summary": "2-3 sentence executive summary of the menu's health and biggest opportunities",
  "overallScore": 7,
  "matrixSummary": {
    "stars": { "count": 3, "items": ["Item A", "Item B"], "advice": "Advice for stars" },
    "plowhorses": { "count": 2, "items": ["Item C"], "advice": "Advice for plowhorses" },
    "puzzles": { "count": 2, "items": ["Item D"], "advice": "Advice for puzzles" },
    "dogs": { "count": 1, "items": ["Item E"], "advice": "Advice for dogs" }
  },
  "pricingInsights": ["Insight 1", "Insight 2"],
  "layoutRecommendations": ["Recommendation 1"],
  "quickWins": ["Quick win 1", "Quick win 2"],
  "estimatedMonthlyImpact": "$X,XXX estimated additional monthly revenue",
  "designTips": {
    "goldenTriangle": "Tip about eye tracking and the golden triangle placement for this menu",
    "boxing": "Tip about boxing/framing high-profit items to draw attention",
    "fontAndColor": "Font and color psychology tip tailored to this cuisine style",
    "menuLength": "Tip about optimal number of items per category for this restaurant type",
    "pricePlacement": "How to display prices to reduce price sensitivity (e.g., no dollar signs, no dotted leaders)"
  }
}

Design tips must be specific to the restaurant's cuisine type and tier. Reference real menu psychology: golden triangle eye-tracking, boxing/framing, decoy pricing, font/color choices, and optimal category sizing.

Classification rules:
- STAR: High profit margin + High popularity. Promote prominently.
- PLOWHORSE: Low profit margin + High popularity. Raise prices or reduce cost.
- PUZZLE: High profit margin + Low popularity. Reposition or improve description.
- DOG: Low profit margin + Low popularity. Consider removing.

List ALL items in the correct matrix category. Every item must appear in exactly one category.`
        },
        {
          role: "user",
          content: `${restaurantContext}\n\nMENU ITEMS:\n${menuItemsList}\n\nProvide the overview audit. List every item in the matrix. Return only JSON.`
        }
      ],
      temperature: 0.3,
      max_tokens: 5000
    });

    const overview = extractJSON(overviewResponse.choices[0].message.content);

    // STEP 2: Get item-by-item analysis in batches
    const allItemAnalyses = [];
    const batches = [];
    for (let i = 0; i < sanitizedItems.length; i += BATCH_SIZE) {
      batches.push(sanitizedItems.slice(i, i + BATCH_SIZE));
    }

    // Run all batches in parallel for speed
    const batchPromises = batches.map(batch => {
      const batchList = batch.map(item =>
        `- ${item.name} | $${item.price} | ${item.category} | "${item.description}"`
      ).join("\n");

      return groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `You are an elite menu engineering consultant. Analyze EACH menu item and return detailed recommendations.

IMPORTANT: Return ONLY a valid JSON object. No markdown fences. You MUST include an entry for EVERY item listed.

{
  "items": [
    {
      "name": "Item Name",
      "currentPrice": 12.99,
      "recommendedPrice": 14.49,
      "priceChange": "+$1.50",
      "classification": "Star",
      "classificationReason": "Brief reason",
      "currentDescription": "Original description",
      "rewrittenDescription": "Improved sensory description",
      "upsellSuggestion": "Add bacon +$2.50",
      "notes": "Specific advice"
    }
  ]
}

Rules:
- Include EVERY item. Do not skip any.
- Classifications: Star, Plowhorse, Puzzle, or Dog
- Never recommend more than 15-20% price increase
- Use charm pricing (.95, .99) for casual, round numbers for upscale
- Descriptions: sensory adjectives, origins, 1-2 lines max
- Match the restaurant vibe based on cuisine type`
          },
          {
            role: "user",
            content: `${restaurantContext}\n\nAnalyze these ${batch.length} items:\n${batchList}\n\nReturn detailed analysis for EVERY item. Return only JSON.`
          }
        ],
        temperature: 0.3,
        max_tokens: 8000
      });
    });

    const batchResponses = await Promise.all(batchPromises);
    for (const batchResponse of batchResponses) {
      const batchResult = extractJSON(batchResponse.choices[0].message.content);
      if (batchResult.items && batchResult.items.length) {
        allItemAnalyses.push(...batchResult.items);
      }
    }

    // Combine overview + item details
    const result = {
      summary: overview.summary,
      overallScore: overview.overallScore,
      matrixSummary: overview.matrixSummary,
      pricingInsights: overview.pricingInsights,
      layoutRecommendations: overview.layoutRecommendations,
      quickWins: overview.quickWins,
      estimatedMonthlyImpact: overview.estimatedMonthlyImpact,
      designTips: overview.designTips,
      items: allItemAnalyses
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result)
    };

  } catch (err) {
    console.error("Analyze menu error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to analyze menu. Please try again." })
    };
  }
};

function extractJSON(text) {
  try {
    return JSON.parse(text);
  } catch (_) {}

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (_) {}
  }

  throw new Error("Could not parse AI response as JSON");
}
