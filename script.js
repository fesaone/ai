/* --- CONFIGURATION & STATE --- */
const knowledgeMap = [
    {
        keys: ["siapa", "pembuat", "creator", "author", "kamu", "identitas", "fauzi", "pengembang", "founder", "dev", "owner", "kapan", "dibuat", "tahun", "tanggal", "rilis", "lahir", "sejarah", "dari", "mana", "asal", "lokasi", "domisili", "tentang", "fesabot", "fesaone"],
        response: "**Fesaone AI** dikembangkan oleh **Fauzi Eka Suryana** di Bandung, Indonesia (Januari 2026).\n\nBeliau adalah Developer, UI/UX Designer, dan Pro Gamer yang memulai karir sejak 2019. Saat ini aktif sebagai Tech Lead untuk teknologi livestreaming di *Radar Bandung* dan *R Media*."
    },
    {
        keys: ["kontak", "email", "hubungi", "call", "tanya", "admin", "telepon", "nomor", "hp", "no", "whatsapp", "wa", "instagram", "ig", "sosmed", "social", "media", "twitter", "linkedin"],
        response: "Anda dapat menghubungi Fauzi Eka Suryana melalui:\n• Email: dev@fesa.one (mailto:dev@fesa.one)\n• Telepon: +62-8999-9400-44\n• Instagram: @fesaonedev (https://instagram.com/fesaonedev)"
    },
    {
        keys: ["layanan", "produk", "jasa", "fitur", "website", "situs", "url", "link", "store", "toko", "belanja", "beli", "harga", "tema", "theme", "plugin", "sistem", "system", "sandbox", "playground", "demo"],
        response: "Layanan Ekosistem Fesaone:\n• **AI Chat:** fesa.one (https://fesa.one/)\n• **Playground:** SANDBOX (https://fesa.one/sandbox/)\n• **Store (Themes & System):** Fesa Store (https://fesa.one/store/)"
    },
    {
        keys: ["terms", "tos", "syarat", "ketentuan", "rules", "privacy", "privasi", "kebijakan", "data", "aman", "riset", "research", "agi", "penelitian", "help", "bantuan", "panduan", "pakai"],
        response: "Info Legal & Riset:\n• Riset AGI: Research Page (https://fesa.one/research/)\n• Privacy & Terms: Lihat Dokumen (https://fesa.one/terms-of-service)"
    }
];

const SYSTEM_PROMPT = "You are Fesaone AI (fesa.one), created by Fauzi Eka Suryana (Bandung, ID). He is a Dev/Designer & Tech Lead at R Media/Radar Bandung. Be helpful, concise, and polite in Indonesian.";
let chatHistory = []; 

/* --- DOM ELEMENTS --- */
const chatContainer = document.getElementById('chat-container');
const messagesWrapper = document.getElementById('messages-wrapper');
const welcomeScreen = document.getElementById('welcome-screen');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const voiceBtn = document.getElementById('voice-btn');
const loadingIndicator = document.getElementById('loading-indicator');
const placeholder = document.getElementById('placeholder');

/* --- LOGIC: UTILITIES & MEMORY --- */

function tokenize(text) {
    return text.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter(w => w.length > 2);
}

function checkLocalMemory(text) {
    const inputTokens = tokenize(text);
    if (inputTokens.length === 0) return null;

    let bestMatch = null;
    let highestScore = 0;
    const THRESHOLD = 0.5;

    knowledgeMap.forEach(item => {
        const keySet = new Set(item.keys.map(k => k.toLowerCase()));
        let matchCount = 0;

        inputTokens.forEach(token => {
            if (keySet.has(token)) matchCount++;
        });

        const score = matchCount / inputTokens.length;

        if (score > THRESHOLD && score > highestScore) {
            highestScore = score;
            bestMatch = item;
        }
    });

    return bestMatch ? bestMatch.response : null;
}

/**
 * FUNGSI UPDATE: Sanitasi, Formatting, & Auto-Link
 * 1. Konversi Markdown (**text*, *text*) ke HTML (<b>, <i>).
 * 2. Jaga Line Break (\n -> <br>).
 * 3. Sanitasi Tag Bahaya (Script, Iframe, dll).
 * 4. AUTO-LINK: Mendeteksi URL (http/https/mailto) dan membungkusnya dengan tag <a> agar bisa diklik.
 */
function formatText(text) {
    if (!text) return "";

    // 1. Konversi Markdown Bold & Italic ke HTML
    let clean = text
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        .replace(/\*(.*?)\*/g, '<i>$1</i>');

    // 2. Konversi Line Break
    clean = clean.replace(/\n/g, '<br>');

    // 3. Auto-Linking (Membungkus URL mentah menjadi tag <a>)
    // Regex mencari http, https, atau mailto diikuti karakter non-spasi
    // Kita lakukan ini SEBELUM sanitasi tag berbahaya agar tag <a> yang kita buat ini tidak ikut dihapus.
    clean = clean.replace(
        /((https?:\/\/)|(mailto:))[^\s<]+/g, 
        function(url) {
            // Menambahkan target="_blank" agar link terbuka di tab baru
            return `<a href="${url}" target="_blank" class="text-blue-400 underline">${url}</a>`;
        }
    );

    // 4. Sanitasi Keamanan (Hapus tag berbahaya KECUALI tag yang kita izinkan: a, b, i, br)
    // Kita whitelist tag yang aman untuk format.
    // Tag lain (script, iframe, img onerror, dll) akan dibuang.
    // Untuk simplifikasi di client-side, kita hapus tag berisiko tinggi secara spesifik.
    const dangerousTags = ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'];
    dangerousTags.forEach(tag => {
        const regex = new RegExp(`<${tag}[^>]*>.*?</${tag}>`, 'gis');
        clean = clean.replace(regex, '');
        // Hapus tag pembuka saja jika tidak berpasangan
        const openRegex = new RegExp(`<${tag}[^>]*>`, 'gi');
        clean = clean.replace(openRegex, '');
    });

    // 5. Bersihkan entity HTML
    clean = clean.replace(/&amp;/g, "&")
                 .replace(/&lt;/g, "<")
                 .replace(/&gt;/g, ">");

    return clean;
}

/* --- LOGIC: UI FUNCTIONS --- */

let isTyping = false;

function scrollToBottom() {
    requestAnimationFrame(() => {
        chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
    });
}

function createMessageBubble(text, isUser) {
    const wrapper = document.createElement('div');
    wrapper.className = `flex w-full mb-4 ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in-up`;
    
    const bubble = document.createElement('div');
    bubble.className = `max-w-[90%] md:max-w-[75%] px-4 py-3 rounded-2xl text-[15px] leading-relaxed break-words shadow-sm border backdrop-blur-sm ${
        isUser 
        ? 'bg-neutral-800 text-neutral-300 border-neutral-700 rounded-br-md' 
        : 'bg-neutral-900/90 text-neutral-200 border-neutral-800 rounded-bl-md'
    }`;

    if (!isUser) {
        const header = document.createElement('div');
        header.className = 'flex items-center gap-2 mb-2 opacity-70';
        header.innerHTML = `
            <div class="w-6 h-6 bg-black rounded-full flex items-center justify-center overflow-hidden border border-neutral-800">
                <img src="https://fesa.one/assets/logo/FESA-ONE.png" alt="FESA" class="w-full h-full object-cover">
            </div>
            <span class="text-[10px] font-bold tracking-wider text-white">FESA AI</span>
        `;
        bubble.appendChild(header);
    }

    const textSpan = document.createElement('div');
    textSpan.className = "ai-text-content";
    
    if (isUser) {
        textSpan.textContent = text;
    } else {
        textSpan.innerHTML = formatText(text);
    }
    
    bubble.appendChild(textSpan);
    wrapper.appendChild(bubble);
    return { wrapper, textSpan };
}

async function handleSubmission(event) {
    if (event) event.preventDefault();
    const text = userInput.value.trim();
    if (!text || isTyping) return;

    if (!welcomeScreen.classList.contains('hidden')) {
        welcomeScreen.classList.add('hidden');
        messagesWrapper.classList.remove('hidden');
    }

    const { wrapper: userWrapper } = createMessageBubble(text, true);
    messagesWrapper.appendChild(userWrapper);
    
    userInput.value = '';
    placeholder.style.display = 'block';
    scrollToBottom();

    isTyping = true;
    loadingIndicator.classList.remove('hidden');
    messagesWrapper.appendChild(loadingIndicator);
    scrollToBottom();

    let responseText = "";
    let isLocalMemory = false;

    const localAnswer = checkLocalMemory(text);
    
    if (localAnswer) {
        console.log("[System] Response from Local Memory");
        isLocalMemory = true;
        await new Promise(r => setTimeout(r, 600)); 
        responseText = localAnswer;

    } else {
        // --- BACKEND CALL (PANGGIL KE SERVER SENDIRI) ---
        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    message: text,
                    history: chatHistory
                })
            });

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            responseText = data.reply;
            
            // Update history lokal agar konteks chat tetap tersimpan di browser
            chatHistory.push({ role: "user", content: text });
            chatHistory.push({ role: "assistant", content: responseText });

        } catch (error) {
            console.error("Chat Error:", error);
            responseText = "Maaf, terjadi gangguan koneksi pada server. Silakan coba lagi.";
        }
        // --------------------------------------------
    }

    loadingIndicator.classList.add('hidden');

    const { wrapper: aiWrapper, textSpan: aiTextSpan } = createMessageBubble("", false);
    messagesWrapper.appendChild(aiWrapper);

    aiTextSpan.innerHTML = formatText(responseText);
    
    isTyping = false;
    scrollToBottom();
    
    if(!('ontouchstart' in window)) {
        userInput.focus();
    }
}

chatForm.addEventListener('submit', handleSubmission);

/* --- SHORTCUT BUTTONS --- */

const btnStudy = document.getElementById('btn-study');
const btnCode = document.getElementById('btn-code');
const btnResearch = document.getElementById('btn-research');

function triggerShortcut(text) {
    if(isTyping) return;
    userInput.value = text;
    placeholder.style.display = 'none';
    handleSubmission(null);
}

if(btnStudy) btnStudy.addEventListener('click', () => triggerShortcut("Bantu saya membuat rencana belajar untuk topik Artificial Intelligence pemula."));
if(btnCode) btnCode.addEventListener('click', () => triggerShortcut("Buatkan contoh struktur HTML5 semantik."));
if(btnResearch) btnResearch.addEventListener('click', () => triggerShortcut("Lakukan analisis mendalam tentang dampak komputasi kuantum terhadap keamanan siber."));

/* --- UTILS: INPUT & VOICE --- */

userInput.addEventListener('focus', () => placeholder.style.display = 'none');
userInput.addEventListener('blur', () => { if (!userInput.value) placeholder.style.display = 'block'; });
userInput.addEventListener('input', () => {
    placeholder.style.display = userInput.value ? 'none' : 'block';
});

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.lang = 'id-ID';
    recognition.interimResults = false;
    recognition.continuous = false;
    
    voiceBtn.addEventListener('click', () => {
        try {
            voiceBtn.classList.add('text-red-500', 'animate-pulse');
            recognition.start();
        } catch (e) {
            console.warn("Voice recognition already started");
        }
    });
    
    recognition.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        userInput.value = transcript;
        placeholder.style.display = 'none';
    };
    
    recognition.onerror = (e) => {
        console.error("Voice Error", e);
        voiceBtn.classList.remove('text-red-500', 'animate-pulse');
    };

    recognition.onend = () => {
        voiceBtn.classList.remove('text-red-500', 'animate-pulse');
    };
} else {
    if(voiceBtn) voiceBtn.style.display = 'none';
}
