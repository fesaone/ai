// functions/api/chat.js
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { message, history } = body;

    // Ambil API Key dari Environment Variables (Langkah 2)
    const apiKey = env.GROQ_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), { status: 500 });
    }

    // 1. Safety Check Logic (Pindah ke sini)
    const safetyCheck = await checkSafety(message, apiKey);
    if (!safetyCheck) {
      return new Response(JSON.stringify({ reply: "Maaf, permintaan Anda tidak dapat diproses karena melanggar kebijakan keamanan sistem." }));
    }

    // 2. Chat Logic (Pindah ke sini)
    const reply = await getChatCompletion(message, history, apiKey);

    return new Response(JSON.stringify({ reply }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

// --- Helper Functions untuk API ---

async function checkSafety(prompt, apiKey) {
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "meta-llama/llama-guard-4-12b",
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        max_tokens: 32,
        response_format: { type: "text" }
      })
    });

    if (!response.ok) return true; // Fail-safe: izinkan jika error
    
    const data = await response.json();
    const resultText = data.choices[0].message.content.toLowerCase();
    return resultText.includes("safe") && !resultText.includes("unsafe");

  } catch (error) {
    console.error("Safety Check Exception:", error);
    return true;
  }
}

async function getChatCompletion(userMessage, history, apiKey) {
  // Filter history agar tidak terlalu panjang (opsional, bisa disesuaikan)
  const recentHistory = (history || []).slice(-10); 

  const messagesToSend = [
    { role: "system", content: "You are Fesaone AI (fesa.one), created by Fauzi Eka Suryana (Bandung, ID). He is a Dev/Designer & Tech Lead at R Media/Radar Bandung. Be helpful, concise, and polite in Indonesian." },
    ...recentHistory,
    { role: "user", content: userMessage }
  ];

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: messagesToSend,
      temperature: 0.7,
      max_tokens: 1024
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices[0].message.content;
}
