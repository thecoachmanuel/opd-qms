
// Medical Knowledge Base & Logic Engine
// Simulates a well-trained medical doctor for patient education and engagement.

interface MedicalTopic {
  keywords: string[];
  response: string | string[];
  category: 'symptom' | 'condition' | 'lifestyle' | 'public_health' | 'emergency' | 'general';
}

const MEDICAL_KNOWLEDGE_BASE: MedicalTopic[] = [
  // --- PUBLIC HEALTH (Nigeria Context) ---
  {
    keywords: ['malaria', 'mosquito', 'fever', 'chills'],
    category: 'public_health',
    response: "Malaria is a life-threatening disease caused by parasites transmitted to people through the bites of infected female Anopheles mosquitoes. \n\n**Prevention:** Sleep under insecticide-treated nets, use insect repellents, and eliminate standing water where mosquitoes breed. \n**Symptoms:** Fever, chills, headache, nausea, and muscle pain. \n\n*If you suspect malaria, please get tested immediately at the clinic.*"
  },
  {
    keywords: ['typhoid', 'salmonella', 'contaminated water', 'food safety'],
    category: 'public_health',
    response: "Typhoid fever is a bacterial infection that can spread throughout the body, affecting many organs. It is caused by Salmonella Typhi bacteria.\n\n**Prevention:** Drink treated/boiled water, eat hot cooked foods, and wash hands frequently.\n**Symptoms:** Prolonged high fever, fatigue, headache, nausea, abdominal pain, and constipation or diarrhea."
  },
  {
    keywords: ['cholera', 'watery stool', 'diarrhea', 'dehydration'],
    category: 'public_health',
    response: "Cholera is an acute diarrheal illness caused by infection of the intestine with Vibrio cholerae bacteria. \n\n**Key Advice:** Rehydration is critical. Drink Oral Rehydration Solution (ORS) immediately if you have watery diarrhea and seek medical help. maintain strict hygiene."
  },

  // --- COMMON SYMPTOMS ---
  {
    keywords: ['headache', 'migraine', 'head pain'],
    category: 'symptom',
    response: [
      "Headaches can result from stress, dehydration, high blood pressure, or eye strain. \n\n**Advice:** Drink plenty of water, rest in a quiet dark room, and manage stress. If the headache is sudden, severe, or accompanied by vision changes, consult a doctor immediately.",
      "A headache is often your body's way of signaling it needs rest or hydration. Have you drunk enough water today? If it persists despite rest and analgesics, please see a GP."
    ]
  },
  {
    keywords: ['stomach pain', 'abdominal pain', 'belly ache', 'ulcer'],
    category: 'symptom',
    response: "Abdominal pain has many causes, from indigestion and ulcers to appendicitis. \n\n**Advice:** Avoid spicy foods and alcohol. If the pain is severe, persistent, or accompanied by vomiting/blood, seek emergency care. Do not self-medicate heavily without a diagnosis."
  },
  {
    keywords: ['chest pain', 'heart attack', 'tightness in chest'],
    category: 'emergency',
    response: "**EMERGENCY ALERT:** Chest pain can be a sign of a heart attack or other serious conditions. \n\nPlease stop what you are doing, sit down, and alert a nurse or doctor immediately if you are in the hospital. If you are at home, seek emergency help right away. Do not ignore chest pain."
  },
  {
    keywords: ['cough', 'coughing', 'sore throat'],
    category: 'symptom',
    response: "A cough can be viral, bacterial, or allergic. \n\n**Advice:** Stay hydrated with warm fluids. Honey and lemon can soothe a sore throat. If the cough lasts more than 2 weeks or produces blood, you must see a doctor to rule out TB or other infections."
  },

  // --- CHRONIC CONDITIONS ---
  {
    keywords: ['diabetes', 'sugar', 'glucose', 'insulin'],
    category: 'condition',
    response: "Diabetes management is about balance. \n\n**Tips:** \n1. Monitor your blood sugar regularly.\n2. Eat a balanced diet rich in fiber and vegetables.\n3. Exercise for at least 30 minutes daily.\n4. Take your medication exactly as prescribed. \n\n*Foot care is also vital - inspect your feet daily for cuts.*"
  },
  {
    keywords: ['hypertension', 'blood pressure', 'hbp', 'pressure'],
    category: 'condition',
    response: "Hypertension (High Blood Pressure) is often called the 'silent killer'. \n\n**Management:** \n1. Reduce salt intake significantly.\n2. Manage stress.\n3. Take prescribed antihypertensives faithfully, even if you feel fine.\n4. Regular checks are mandatory. \n\n*Uncontrolled BP can lead to stroke or kidney failure.*"
  },
  {
    keywords: ['asthma', 'wheezing', 'inhaler', 'shortness of breath'],
    category: 'condition',
    response: "Asthma management requires knowing your triggers (dust, smoke, pollen, cold air). \n\n**Advice:** Always carry your rescue inhaler. If you need it more than twice a week, your asthma may not be well-controlled—please see your doctor to adjust your controller medication."
  },

  // --- LIFESTYLE & NUTRITION ---
  {
    keywords: ['diet', 'food', 'nutrition', 'eating', 'weight loss', 'healthy', 'lifestyle'],
    category: 'lifestyle',
    response: "A healthy lifestyle is the foundation of good health. \n\n**Lara's Recommendation:** \n- Fill half your plate with vegetables.\n- Choose whole grains over refined carbs.\n- Drink water instead of sugary sodas.\n- Aim for 30 mins of activity daily.\n- Sleep 7-9 hours."
  },
  {
    keywords: ['exercise', 'workout', 'fitness', 'gym'],
    category: 'lifestyle',
    response: "Exercise is medicine! Aim for at least 150 minutes of moderate activity per week (like brisk walking). \n\n**Benefits:** Improves heart health, controls weight, boosts mood, and improves sleep. Start small—even a 20-minute walk daily makes a huge difference."
  },
  {
    keywords: ['sleep', 'insomnia', 'tired', 'fatigue'],
    category: 'lifestyle',
    response: "Sleep is when your body repairs itself. Adults need 7-9 hours. \n\n**Tips for better sleep:** \n- Stick to a schedule.\n- Avoid screens (phones/TV) 1 hour before bed.\n- Avoid caffeine after 2 PM.\n- Keep your bedroom dark and cool."
  },
  {
    keywords: ['stress', 'anxiety', 'mental health', 'depression', 'sad'],
    category: 'lifestyle',
    response: "Mental health is as important as physical health. \n\n**Advice:** Talk to someone you trust. Practice deep breathing or meditation. If you feel overwhelmed, persistent sadness, or loss of interest in life, please speak to a doctor or psychologist. There is no shame in seeking help."
  },

  // --- MATERNAL & CHILD ---
  {
    keywords: ['pregnancy', 'pregnant', 'baby', 'prenatal'],
    category: 'condition',
    response: "Congratulations on the pregnancy! \n\n**Key Steps:** \n1. Register for Antenatal Care (ANC) early.\n2. Take your folic acid and iron supplements.\n3. Eat a nutritious diet.\n4. Watch for danger signs (bleeding, severe headache, water breaking early). \n\n*Attend all scheduled clinic visits.*"
  },
  {
    keywords: ['breastfeeding', 'breast milk', 'nursing'],
    category: 'lifestyle',
    response: "Breast milk is the best food for your baby. \n\n**Advice:** Exclusive breastfeeding for the first 6 months gives your baby powerful antibodies and perfect nutrition. It also helps the uterus contract and burns calories for the mother."
  },

  // --- GENERAL/TRIVIA ---
  {
    keywords: ['bored', 'trivia', 'fact', 'tell me something', 'entertain'],
    category: 'general',
    response: [
      "Did you know? The human body has enough blood vessels to circle the Earth 2.5 times!",
      "Medical Fact: Your heart beats about 100,000 times a day.",
      "Health Tip: Laughing is good for the heart! It increases blood flow by 20%.",
      "Did you know? The strongest muscle in the human body (based on weight) is the masseter (jaw muscle).",
      "Fact: Your skin is the body's largest organ and renews itself every 28 days."
    ]
  }
];

const DEFAULT_RESPONSES = [
  "I can provide information on symptoms, diseases, diet, and healthy living. What's on your mind?",
  "As a virtual health assistant, I can help explain medical conditions or give lifestyle advice. Please ask me specifically about what you're feeling or wondering.",
  "I'm here to keep you company with health knowledge. Ask me about Malaria, Diabetes, Diet, or just say 'I'm bored' for a fun fact!"
];

export const analyzeMedicalQuery = (query: string): string | null => {
  const lowerQuery = query.toLowerCase();
  
  // 1. Direct Keyword Matching (Scoring System)
  let bestMatch: MedicalTopic | null = null;
  let maxScore = 0;

  MEDICAL_KNOWLEDGE_BASE.forEach(topic => {
    let score = 0;
    topic.keywords.forEach(keyword => {
      if (lowerQuery.includes(keyword)) {
        score += keyword.length; // Longer keywords weigh more
      }
    });

    if (score > maxScore) {
      maxScore = score;
      bestMatch = topic;
    }
  });

  if (bestMatch && maxScore > 0) {
    const topic = bestMatch as MedicalTopic;
    let responseText = '';
    
    if (Array.isArray(topic.response)) {
      // Pick random response if array
      responseText = topic.response[Math.floor(Math.random() * topic.response.length)];
    } else {
      responseText = topic.response as string;
    }

    // Append Disclaimer for medical advice
    if (topic.category === 'symptom' || topic.category === 'condition' || topic.category === 'emergency') {
        responseText += "\n\n*(Note: I am an AI. This is for educational purposes only and does not replace professional medical diagnosis.)*";
    }

    return responseText;
  }

  // 2. Fallback for "Doctor" or "Medical" queries that didn't match specific topics
  if (lowerQuery.includes('doctor') || lowerQuery.includes('medical') || lowerQuery.includes('sick') || lowerQuery.includes('pain')) {
    return "I hear you. While I can share general medical knowledge, for specific persistent pain or sickness, seeing a doctor is the best course of action. Can I help you book an appointment?";
  }

  return null;
};

export const getHealthTip = (): string => {
   const lifestyleTopics = MEDICAL_KNOWLEDGE_BASE.filter(t => t.category === 'lifestyle' || t.category === 'general');
   const randomTopic = lifestyleTopics[Math.floor(Math.random() * lifestyleTopics.length)];
   if (Array.isArray(randomTopic.response)) {
       return randomTopic.response[Math.floor(Math.random() * randomTopic.response.length)];
   }
   return randomTopic.response as string;
};
