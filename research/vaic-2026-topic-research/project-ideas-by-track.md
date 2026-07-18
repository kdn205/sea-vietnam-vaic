# VAIC 2026 — Topic Research: ~10 Project Ideas per Track

**Goal:** For each of the 8 challenge tracks, propose ~10 concrete project topics that:
- Address **real-life problems** (not theoretical exercises)
- Put **AI at the core** (not a bolt-on feature)
- Score well on the **judging criteria**: real-world applicability, AI-native architecture, prototype completion viability (48h), post-competition scalability, and innovation
- Offer clear **impact potential** for Vietnam's context

---

## Track 1: Banking & Finance (Ngân hàng & Tài chính)

### 1.1 Alternative-Data Credit Scoring for the Unbanked
- **Problem:** ~70% of Vietnamese adults lack credit history → excluded from formal loans.
- **AI Integration:** ML model trained on telco data, utility payments, e-commerce history, and behavioural signals to generate a credit score without traditional bureau data.
- **Impact:** Financial inclusion for millions; SHB (sponsor) could deploy directly.
- **Scoring Alignment:** Real-world applicability ★★★★★ | AI-native ★★★★★ | 48h viability ★★★★☆ | Scalability ★★★★★
- **Feasibility:** MVP with a subset of features + explainability dashboard in 48h.

### 1.2 Real-Time Transaction Fraud Detection with GNN
- **Problem:** Card-not-present fraud and account takeover are rising with digital payments.
- **AI Integration:** Graph Neural Network (GNN) over transaction graphs to detect anomalous spending patterns and fraud rings in real time.
- **Impact:** Millions in loss prevention; deployable at any Vietnamese bank.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★☆☆ | Scalability ★★★★★
- **Feasibility:** Demo with synthetic transaction stream + pre-trained model.

### 1.3 AI-Powered Personal Finance Advisor (Robo-Advisor)
- **Problem:** Low financial literacy; most Vietnamese lack budgeting and investment tools.
- **AI Integration:** NLP to categorise expenses, ML to predict cash flow, optimisation engine for savings/investment allocation.
- **Impact:** Democratises financial planning for the mass market.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★☆ | 48h ★★★★★ | Scalability ★★★★★

### 1.4 Automated KYC/AML Compliance Screening
- **Problem:** Manual KYC checks take 3–5 days; AML false positives overwhelm compliance teams.
- **AI Integration:** OCR + NLP for document verification; ML for risk scoring; anomaly detection for transaction monitoring.
- **Impact:** Reduces compliance cost by 60%+, speeds onboarding.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★☆☆ | Scalability ★★★★★

### 1.5 Intelligent Loan Origination & Risk Assessment for SMEs
- **Problem:** SMEs struggle to access credit; banks lack efficient automated assessment.
- **AI Integration:** Multi-source data fusion (tax records, bank statements, social signals) + ML risk model for automated pre-approval.
- **Impact:** Unlocks SME lending at scale.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★☆ | Scalability ★★★★★

### 1.6 NLP for Financial Report Analysis & Earnings Insights
- **Problem:** Analysts spend hours reading quarterly reports; Vietnamese-language financial documents are not well covered by existing tools.
- **AI Integration:** Fine-tuned LLM to extract key metrics, sentiment, and risk indicators from Vietnamese financial reports and earnings calls.
- **Impact:** Institutional investors and retail both benefit from faster insights.
- **Scoring Alignment:** Real-world ★★★★☆ | AI-native ★★★★★ | 48h ★★★★★ | Scalability ★★★★☆

### 1.7 AI Chatbot with Transaction Intelligence
- **Problem:** Current banking chatbots handle only FAQs; cannot answer "where did my money go?" meaningfully.
- **AI Integration:** RAG pipeline + transaction graph query + NL-to-SQL for personalised spending analysis and financial advice.
- **Impact:** Improves customer engagement and reduces call centre load.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★★ | Scalability ★★★★★

### 1.8 Micro-Investment Platform with ML Allocation
- **Problem:** Young Vietnamese see investing as complex; minimum investment amounts are high.
- **AI Integration:** Risk-profiling questionnaire → ML portfolio allocation → automated micro-rebalancing with fractional shares.
- **Impact:** Engages Gen Z in wealth building.
- **Scoring Alignment:** Real-world ★★★★☆ | AI-native ★★★☆☆ | 48h ★★★★☆ | Scalability ★★★★★

### 1.9 AI for Insurance Underwriting & Claim Triage
- **Problem:** Manual underwriting is slow; claim processing is prone to inconsistency.
- **AI Integration:** Computer vision for damage assessment (auto/home), NLP for claim narrative analysis, ML for risk-based pricing.
- **Impact:** Faster claims, fairer pricing.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★☆☆ | Scalability ★★★★★

### 1.10 Cross-Border Remittance FX Prediction
- **Problem:** Vietnamese overseas workers lose money to unfavourable FX rates and fees.
- **AI Integration:** Time-series transformer model predicting optimal remittance timing; multi-currency route optimisation.
- **Impact:** Saves millions in remittance fees annually.
- **Scoring Alignment:** Real-world ★★★★☆ | AI-native ★★★★★ | 48h ★★★★☆ | Scalability ★★★★☆

---

## Track 2: Healthcare (Y Tế & Sức Khỏe)

### 2.1 AI-Assisted ER Triage System
- **Problem:** Emergency rooms in Vietnamese hospitals are overcrowded; triage is subjective and inconsistent.
- **AI Integration:** ML model trained on vital signs, symptoms (NLP from intake), and historical outcomes to recommend triage priority (1–5 scale).
- **Impact:** Reduces waiting times for critical patients; saves lives.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★☆ | Scalability ★★★★★

### 2.2 Chest X-Ray Screening for Tuberculosis
- **Problem:** Vietnam has a high TB burden; radiologists are scarce in rural areas.
- **AI Integration:** CNN (ResNet/EfficientNet) trained on CXR dataset for TB vs. normal classification with localisation heatmaps.
- **Impact:** Mass screening in remote provinces becomes viable.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★☆☆ | Scalability ★★★★★

### 2.3 Vietnamese Medical Record Summarisation & ICD Coding
- **Problem:** Doctors spend 30%+ of their time on documentation; coding errors cause reimbursement delays.
- **AI Integration:** Fine-tuned Vietnamese LLM to extract clinical entities, generate SOAP summaries, and suggest ICD-10 codes.
- **Impact:** Administrative burden reduction; accuracy improvement.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★★ | Scalability ★★★★★

### 2.4 Drug Interaction & Adverse Event Predictor
- **Problem:** Polypharmacy patients face dangerous drug interactions that are hard to catch manually.
- **AI Integration:** Knowledge graph + GNN over drug–drug interaction databases + NLP from Vietnamese pharmacovigilance reports.
- **Impact:** Prevents adverse events; improves patient safety.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★☆ | Scalability ★★★★★

### 2.5 Remote Patient Monitoring with Deterioration Alerts
- **Problem:** Post-discharge patients, especially in rural areas, lack follow-up monitoring.
- **AI Integration:** Time-series model (LSTM/Transformer) on wearable vitals data predicting deterioration 6–12 hours before clinical events.
- **Impact:** Reduces readmission rates; enables telehealth at scale.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★☆ | Scalability ★★★★★

### 2.6 Mental Health Support Chatbot with Sentiment Monitoring
- **Problem:** Mental health services are severely under-resourced in Vietnam; stigma prevents help-seeking.
- **AI Integration:** Fine-tuned LLM for empathetic conversation + sentiment analysis for crisis detection + escalation trigger.
- **Impact:** 24/7 first-line mental health support; destigmatises help-seeking.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★★ | Scalability ★★★★★

### 2.7 AI-Driven Personalised Treatment Recommendation
- **Problem:** Treatment guidelines are one-size-fits-all; physicians lack decision support.
- **AI Integration:** ML matching patient profile (genomics, comorbidities, history) to treatment outcomes from medical literature.
- **Impact:** Precision medicine at scale; better outcomes.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★☆☆ | Scalability ★★★★☆

### 2.8 Epidemic Outbreak Predictor from Social & Health Data
- **Problem:** Disease outbreaks (dengue, seasonal flu) spread fast; early detection is reactive.
- **AI Integration:** Fusion model ingesting hospital admission rates, social media symptom mentions, weather, and mobility data for outbreak forecasting.
- **Impact:** Proactive public health response; pandemic preparedness.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★☆☆ | Scalability ★★★★★

### 2.9 Telemedicine Diagnostic Assistant for Rural Clinics
- **Problem:** Rural clinics lack specialist doctors; patients travel hours for basic diagnosis.
- **AI Integration:** Multi-modal AI combining symptom checker (NLP), image analysis (dermatology/retinal), and lab result interpretation into a diagnostic suggestion tool.
- **Impact:** Brings specialist-level diagnostics to 60%+ of Vietnam's population.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★☆☆☆ | Scalability ★★★★★

### 2.10 Radiology Report Generation from CT/MRI
- **Problem:** Radiologists in Vietnam have extreme workloads (100+ scans/day); reporting is slow.
- **AI Integration:** Vision–language model that segments findings from medical images and generates structured Vietnamese reports.
- **Impact:** Doubles radiologist throughput.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★☆☆☆ | Scalability ★★★★★

---

## Track 3: Education & Training (Giáo Dục & Đào Tạo)

### 3.1 Adaptive Learning Platform with Real-Time Knowledge Tracing
- **Problem:** Vietnamese classrooms follow fixed pacing; struggling students fall behind, advanced students get bored.
- **AI Integration:** Bayesian Knowledge Tracing (BKT) / Deep Knowledge Tracing (DKT) to model student mastery per concept and dynamically adjust difficulty and content.
- **Impact:** Personalised learning at scale; closes achievement gaps.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★☆ | Scalability ★★★★★

### 3.2 AI-Powered Vietnamese Essay Grading & Feedback
- **Problem:** Teachers spend hours grading essays; feedback is delayed and inconsistent.
- **AI Integration:** Fine-tuned Vietnamese LLM evaluating essays on rubric dimensions (argument coherence, grammar, vocabulary) with specific feedback.
- **Impact:** Frees teachers for higher-value instruction; students get instant feedback.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★★ | Scalability ★★★★★

### 3.3 Personalised STEM Tutor Chatbot (Socratic Method)
- **Problem:** Students lack one-on-one tutoring; parents cannot afford private tutors.
- **AI Integration:** LLM with Socratic questioning chain — guides students to the answer via questions, not direct solutions. Tracks concept mastery.
- **Impact:** Equalises access to quality tutoring regardless of income.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★★ | Scalability ★★★★★

### 3.4 Automated Quiz & Assignment Generator
- **Problem:** Teachers spend significant time creating assessments.
- **AI Integration:** LLM that ingests lecture slides/notes and generates multiple-choice, short-answer, and coding questions with answer keys and difficulty tags.
- **Impact:** Dramatically reduces teacher prep time.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★★ | Scalability ★★★★★

### 3.5 Learning Path Optimiser Using Knowledge Tracing
- **Problem:** Existing LMS platforms don't adapt learning sequences per student.
- **AI Integration:** Reinforcement learning agent that selects the next best learning object (video, quiz, reading) based on predicted knowledge gain.
- **Impact:** Optimises learning efficiency; reduces time-to-mastery.
- **Scoring Alignment:** Real-world ★★★★☆ | AI-native ★★★★★ | 48h ★★★☆☆ | Scalability ★★★★★

### 3.6 AI Study Companion with Spaced Repetition
- **Problem:** Forgetting curve causes students to re-study material inefficiently.
- **AI Integration:** ML model determining optimal review timing per knowledge item (SM-2 variant) + content summarisation for quick review.
- **Impact:** Exam preparation becomes 2–3x more efficient.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★☆ | 48h ★★★★★ | Scalability ★★★★★

### 3.7 Vietnamese Sign Language Translation for Inclusive Education
- **Problem:** Deaf and hard-of-hearing students face severe barriers in mainstream education.
- **AI Integration:** Computer vision (mediapipe/mediapipe-holistic) → Transformer-based sign-to-text and text-to-sign avatar system.
- **Impact:** Inclusive education for ~2 million hearing-impaired Vietnamese.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★☆☆ | Scalability ★★★★☆

### 3.8 AI Content & Plagiarism Detection for Vietnamese Submissions
- **Problem:** AI-written assignments are rising; universities lack detection tools for Vietnamese text.
- **AI Integration:** Fine-tuned RoBERTa-based model distinguishing human vs. AI-generated Vietnamese text, plus cross-lingual plagiarism detection.
- **Impact:** Academic integrity preservation.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★☆ | Scalability ★★★★★

### 3.9 Career Path Recommendation from Skills & Market Data
- **Problem:** Students choose majors without data on actual labour market demand.
- **AI Integration:** Embedding-based matching of student skills/interests → job market data (Vietnam-specific) → personalised career pathway with skill gap analysis.
- **Impact:** Reduces skill mismatch; improves graduate employment rates.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★★ | Scalability ★★★★★

### 3.10 Interactive AI Teaching Assistant for Large Classes
- **Problem:** University lectures have 200+ students; individual Q&A is impossible.
- **AI Integration:** Multi-agent system: one agent answers lecture-content questions (RAG), another monitors chat for confusion signals, a third generates real-time practice questions.
- **Impact:** Scales instructor presence to any class size.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★☆ | Scalability ★★★★★

---

## Track 4: Disaster Prevention (Phòng Chống Thiên Tai)

### 4.1 Real-Time Flood Prediction from Sensor & Weather Data
- **Problem:** Vietnam's Mekong Delta and central regions face frequent, deadly floods; warnings are hours too late.
- **AI Integration:** LSTM/Transformer time-series model over rainfall, river level, soil moisture, and upstream water release data to predict flood depth and timing.
- **Impact:** Hours of additional evacuation time; saves lives and property.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★☆ | Scalability ★★★★★

### 4.2 Post-Disaster Damage Assessment from Satellite Imagery
- **Problem:** Manual damage assessment after floods/typhoons takes days; delays aid delivery.
- **AI Integration:** CNN (U-Net/Swin) comparing pre/post satellite imagery to segment flooded areas, damaged buildings, and blocked roads.
- **Impact:** Damage maps in hours instead of days; targeted relief.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★☆☆ | Scalability ★★★★★

### 4.3 Landslide Early Warning System
- **Problem:** Mountainous regions (Lao Cai, Ha Giang, Son La) experience deadly landslides during rainy season.
- **AI Integration:** ML classifier integrating slope, soil type, rainfall intensity, and seismic data to issue landslide risk warnings per commune.
- **Impact:** Targeted evacuations; infrastructure protection.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★☆☆ | Scalability ★★★★★

### 4.4 Wildfire Spread Modelling with Weather & Vegetation Data
- **Problem:** Dry-season forest fires damage ecosystems and air quality (e.g., U Minh Thuong).
- **AI Integration:** Cellular automata + ML emulator predicting fire spread direction and speed from wind, humidity, fuel load, and topography.
- **Impact:** Better firefighting resource deployment.
- **Scoring Alignment:** Real-world ★★★★☆ | AI-native ★★★★☆ | 48h ★★★☆☆ | Scalability ★★★★☆

### 4.5 Social Media Mining for Real-Time Disaster Reporting
- **Problem:** Official disaster reporting is slow; citizens post real-time updates on Facebook/Zalo.
- **AI Integration:** NLP pipeline for Vietnamese social media: event detection, geolocation extraction, severity classification, fake-news filtering.
- **Impact:** Real-time situational awareness for authorities.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★★ | Scalability ★★★★★

### 4.6 Dynamic Evacuation Route Optimisation
- **Problem:** Evacuation plans are static; road blockages during disasters make them useless.
- **AI Integration:** Graph neural net + dynamic routing algorithm that ingests real-time hazard data (flood depth, road closures, traffic) to recommend optimal evacuation paths.
- **Impact:** Adaptive evacuations that actually work during a crisis.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★☆ | Scalability ★★★★★

### 4.7 Building Collapse Risk Assessment from Sensor Data
- **Problem:** Older buildings in urban areas (particularly Hanoi/HCMC) are vulnerable to typhoons and subsidence.
- **AI Integration:** Anomaly detection on vibration/sensor data streams; ML model predicting structural failure probability.
- **Impact:** Preventative maintenance; life safety.
- **Scoring Alignment:** Real-world ★★★★☆ | AI-native ★★★★★ | 48h ★★★☆☆ | Scalability ★★★★☆

### 4.8 Storm Surge & Coastal Flooding Prediction
- **Problem:** 3,200 km coastline exposes Vietnam to typhoon storm surges.
- **AI Integration:** Physics-informed neural network (PINN) combining atmospheric pressure, wind speed, tide data, and bathymetry for surge height prediction.
- **Impact:** Coastal community preparedness; infrastructure protection.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★☆☆☆ | Scalability ★★★★★

### 4.9 AI-Powered Disaster Resource Allocation & Logistics
- **Problem:** Relief supplies (food, water, medicine) often arrive late or to wrong locations.
- **AI Integration:** Optimisation + ML demand forecasting: predict need per location based on disaster severity, population density, and accessibility, then optimise supply routes.
- **Impact:** Faster, smarter aid delivery; reduced waste.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★☆ | Scalability ★★★★★

### 4.10 Drought Prediction with Climate Ensemble Analysis
- **Problem:** Central Highlands and Mekong Delta face increasingly severe droughts.
- **AI Integration:** Multi-model ensemble + ML downscaling to predict drought indices (SPI, SPEI) 1–3 months ahead at district level.
- **Impact:** Proactive agricultural planning; water resource management.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★☆☆ | Scalability ★★★★★

---

## Track 5: Innovation (Đổi Mới Sáng Tạo)

### 5.1 AI-Powered Prototype Testing & Validation Platform
- **Problem:** New product ideas waste months building before discovering low demand.
- **AI Integration:** LLM generates landing pages, survey questions, and simulated user reactions; ML predicts adoption likelihood from concept descriptions.
- **Impact:** Rapid idea validation; reduces failure cost.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★★ | Scalability ★★★★★

### 5.2 Vietnamese Code Generation & Debugging Assistant
- **Problem:** Vietnamese developers often work without pair programmers; English-heavy tools don't support Vietnamese prompts well.
- **AI Integration:** Fine-tuned code LLM (Code Llama/DeepSeek Coder) optimised for Vietnamese-language prompts + Vietnamese API documentation RAG.
- **Impact:** Developer productivity leap for Vietnam's 500K+ developers.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★★ | Scalability ★★★★★

### 5.3 Intelligent Patent & Prior-Art Search
- **Problem:** Vietnamese inventors and SMEs don't conduct proper prior-art searches before filing patents; rejection rates are high.
- **AI Integration:** Semantic search + embedding-based matching over global patent databases and Vietnamese-language scientific literature.
- **Impact:** Higher patent grant rates; protects IP.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★☆ | Scalability ★★★★★

### 5.4 AI Product–Market Fit Analyser
- **Problem:** 90% of startups fail; founders lack systematic PMF assessment.
- **AI Integration:** NLP pipeline analysing customer interviews, survey responses, and usage data to quantify PMF signals (Sean Ellis test, retention cohorts).
- **Impact:** Data-driven pivot/continue decisions.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★★ | Scalability ★★★★★

### 5.5 Automated UX Testing with Computer Vision
- **Problem:** Usability testing requires recruiting participants and manual observation.
- **AI Integration:** Computer vision (screen recording analysis) + gaze prediction + interaction heatmap generation to auto-detect UX friction points.
- **Impact:** 24/7 automated usability evaluation.
- **Scoring Alignment:** Real-world ★★★★☆ | AI-native ★★★★★ | 48h ★★★★☆ | Scalability ★★★★★

### 5.6 Cross-Lingual Knowledge Transfer Bridge (VN ↔ EN)
- **Problem:** Cutting-edge tech knowledge is mostly in English; Vietnamese engineers face language barriers.
- **AI Integration:** Multi-lingual LLM pipeline that summarises English technical content into Vietnamese + preserves code snippets + adapts examples to local context.
- **Impact:** Democratises global tech knowledge for Vietnamese engineers.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★★ | Scalability ★★★★★

### 5.7 Scientific Literature Synthesis & Hypothesis Generator
- **Problem:** Researchers spend months reading papers before identifying research gaps.
- **AI Integration:** RAG over paper databases → extractive + abstractive synthesis → graph-based research gap identification → hypothesis generation.
- **Impact:** Accelerates Vietnamese academic research output.
- **Scoring Alignment:** Real-world ★★★★☆ | AI-native ★★★★★ | 48h ★★★★☆ | Scalability ★★★★★

### 5.8 Smart Inventory with ML Demand Forecasting (for Retail)
- **Problem:** Vietnamese retailers (especially SMEs) overstock or stockout frequently.
- **AI Integration:** Multi-horizon time-series model (DeepAR/Temporal Fusion Transformer) incorporating promotions, seasonality, weather, and local events.
- **Impact:** 20–30% inventory cost reduction.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★☆ | Scalability ★★★★★

### 5.9 AI Legal Document Review & Contract Analysis
- **Problem:** Legal document review is slow, expensive, and error-prone.
- **AI Integration:** Fine-tuned Vietnamese legal LLM extracting clauses, obligations, risks, and deadlines from contracts; flagging non-standard terms.
- **Impact:** 80% reduction in contract review time.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★☆ | Scalability ★★★★★

### 5.10 No-Code Workflow Automation Builder
- **Problem:** Small businesses rely on manual processes because automation tools require technical skills.
- **AI Integration:** LLM that translates natural language ("when I get an email with an invoice, save it to my folder and send a confirmation") → executable workflow (n8n/Zapier-like).
- **Impact:** Empowers non-technical users to automate.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★☆ | Scalability ★★★★★

---

## Track 6: SME Productivity (Năng Suất Doanh Nghiệp Vừa & Nhỏ)

### 6.1 AI Inventory Forecasting for Small Retail
- **Problem:** Small retailers in Vietnam lose 15–30% of revenue to stockouts or overstock.
- **AI Integration:** Lightweight time-series model (Prophet/LightGBM) using sales history, seasonality, and promotions data; dashboard with reorder alerts.
- **Impact:** 20%+ revenue recovery through optimal stocking.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★☆ | 48h ★★★★★ | Scalability ★★★★★

### 6.2 Automated Bookkeeping from Receipts/Invoices
- **Problem:** SME owners spend hours on manual bookkeeping; accounting software is underutilised.
- **AI Integration:** OCR (Vietnamese receipt layout) + LLM categoriser → auto-populated ledger → tax preparation report.
- **Impact:** Saves 10+ hours/week per business.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★★ | Scalability ★★★★★

### 6.3 Smart CRM: Sentiment Analysis & Churn Prediction
- **Problem:** SMEs lose customers without understanding why; they lack analytics resources.
- **AI Integration:** NLP on customer messages/reviews → sentiment trends → churn prediction model → proactive retention suggestions.
- **Impact:** Reduces churn by 15–25% for SME clients.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★★ | Scalability ★★★★★

### 6.4 AI Social Media Content Generator & Scheduler
- **Problem:** SMEs cannot afford marketing teams; social media presence is inconsistent.
- **AI Integration:** LLM generating platform-optimised content (Vietnamese tone) + image suggestions (DALL·E/Stability) + optimal posting time prediction.
- **Impact:** Professional-grade social media for any budget.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★★ | Scalability ★★★★★

### 6.5 Intelligent Document Management with Semantic Search
- **Problem:** SMEs store contracts, invoices, and policies in scattered folders; retrieval is painful.
- **AI Integration:** Document ingestion pipeline → embedding vector store → semantic search + document Q&A + automatic folder classification.
- **Impact:** Instant document retrieval; 70% less time searching.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★★ | Scalability ★★★★★

### 6.6 Automated Supplier Matching & Procurement Optimisation
- **Problem:** SMEs lack purchasing power and pay above-market rates for supplies.
- **AI Integration:** ML matching purchase requests to best supplier based on price, quality, delivery time; aggregate demand for bulk discounts.
- **Impact:** 10–20% procurement cost reduction.
- **Scoring Alignment:** Real-world ★★★★☆ | AI-native ★★★★★ | 48h ★★★★☆ | Scalability ★★★★★

### 6.7 AI-Driven Pricing Optimisation & Competitor Monitoring
- **Problem:** SMEs guess prices; competitors undercut them silently.
- **AI Integration:** Web scraping competitor prices → dynamic pricing recommendation engine (RL/bandit) → margin optimisation.
- **Impact:** 5–15% margin improvement.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★★ | Scalability ★★★★★

### 6.8 Smart Scheduling & Resource Allocation for Service SMEs
- **Problem:** Service businesses (salons, repair shops, clinics) lose revenue to no-shows and idle time.
- **AI Integration:** ML predicting no-show probability → overbooking optimisation → smart scheduling that minimises gaps and overtime.
- **Impact:** 15–25% utilisation improvement.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★★ | Scalability ★★★★★

### 6.9 Automated Compliance & Tax Document Assistant
- **Problem:** Vietnamese tax regulations are complex and change frequently; SMEs get fined for non-compliance.
- **AI Integration:** RAG over current tax code + document analysis → auto-fill tax forms → compliance checklist generation.
- **Impact:** Reduces compliance errors and late filings.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★☆ | Scalability ★★★★★

### 6.10 Multi-Agent Operations Orchestrator for SMEs
- **Problem:** SME owners juggle inventory, accounting, marketing, and HR — spread across tools.
- **AI Integration:** Multi-agent system with specialised agents (inventory agent, sales agent, HR agent) coordinated by a master agent that accepts natural-language business queries.
- **Impact:** One natural-language interface to run the entire business.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★☆☆ | Scalability ★★★★★

---

## Track 7: Smart Government (Chính Phủ Thông Minh)

### 7.1 Multi-Lingual Public Service Chatbot
- **Problem:** Citizens struggle to navigate bureaucratic procedures; Vietnamese, ethnic minority languages, and English all need support.
- **AI Integration:** Multi-lingual RAG pipeline over official procedures database → NL query → step-by-step guidance in user's language (Kinh, H'Mong, Tay, English).
- **Impact:** Reduces in-person visits; improves accessibility for ethnic minorities.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★★ | Scalability ★★★★★

### 7.2 Smart Traffic Management with Real-Time Flow Optimisation
- **Problem:** Hanoi and HCMC lose billions of VND daily to traffic congestion.
- **AI Integration:** Computer vision from traffic cameras → traffic volume/density estimation → RL-based traffic light timing optimisation.
- **Impact:** 15–25% congestion reduction.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★☆☆ | Scalability ★★★★★

### 7.3 Automated Public Complaint Analysis & Routing
- **Problem:** Citizens submit complaints through multiple channels; they get lost in bureaucracy.
- **AI Integration:** NLP classifying complaint type, urgency, and department → auto-routing → sentiment tracking → escalation trigger.
- **Impact:** Faster resolution; transparent tracking.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★★ | Scalability ★★★★★

### 7.4 AI Urban Planning Simulator
- **Problem:** Urban development decisions lack simulation; unintended consequences emerge years later.
- **AI Integration:** Multi-agent simulation (ABM) + ML surrogate model to predict effects of zoning changes, transport infrastructure, and green space on traffic, housing prices, and pollution.
- **Impact:** Evidence-based urban policy.
- **Scoring Alignment:** Real-world ★★★★☆ | AI-native ★★★★★ | 48h ★★☆☆☆ | Scalability ★★★★★

### 7.5 Intelligent Public Procurement Fraud Detection
- **Problem:** Government procurement in Vietnam loses an estimated 10–20% to corruption and collusion.
- **AI Integration:** Network analysis of bidding patterns (same IPs, identical formatting, price clustering) + anomaly detection for collusive behaviour.
- **Impact:** Billions saved; fair competition restored.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★☆ | Scalability ★★★★★

### 7.6 City Digital Twin for Infrastructure Monitoring
- **Problem:** Urban infrastructure (bridges, water pipes, power lines) is maintained reactively.
- **AI Integration:** Digital twin fed by IoT sensors + anomaly detection predicting failures before they happen + maintenance scheduling optimisation.
- **Impact:** Preventive maintenance; budget efficiency.
- **Scoring Alignment:** Real-world ★★★★☆ | AI-native ★★★★★ | 48h ★★☆☆☆ | Scalability ★★★★★

### 7.7 AI-Facilitated Citizen Participation & Feedback Analysis
- **Problem:** Public consultations have low participation; feedback is unstructured and ignored.
- **AI Integration:** NLP pipeline analysing social media, forums, surveys → topic modelling → sentiment per district → policy recommendation summaries.
- **Impact:** Citizen voices inform policy; increased trust.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★★ | Scalability ★★★★★

### 7.8 Automated Permit Processing with Document Verification
- **Problem:** Business permits take weeks; manual verification is slow and inconsistent.
- **AI Integration:** OCR + document verification (forgery detection) + rule-based eligibility check + LLM for missing-document communication.
- **Impact:** Cuts processing time from weeks to hours.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★☆ | Scalability ★★★★★

### 7.9 Smart Waste Management: Route & Bin Optimisation
- **Problem:** Vietnamese cities struggle with waste collection inefficiency; overflowing bins, wasted fuel.
- **AI Integration:** IoT fill-level sensors + ML route optimisation (VRP with time windows) predicting fill rates and scheduling efficient collection.
- **Impact:** 20–30% cost reduction in waste management.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★☆ | Scalability ★★★★★

### 7.10 AI for Public Health Resource Allocation & Policy Simulation
- **Problem:** Health budget allocation is historically based, not data-driven.
- **AI Integration:** System dynamics model + ML to simulate health outcomes under different budget allocations (vaccination campaigns, hospital staffing, preventive care).
- **Impact:** Optimal health spending; better population health.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★☆☆ | Scalability ★★★★★

---

## Track 8: Agriculture (Nông Nghiệp)

### 8.1 AI-Powered Crop Yield Prediction at District Level
- **Problem:** Farmers and policymakers lack reliable yield forecasts; supply chain planning is poor.
- **AI Integration:** Multi-modal: satellite imagery (NDVI), weather data, soil sensors → ensemble ML model predicting yield 1–3 months before harvest.
- **Impact:** Better planting decisions; stable food prices; export planning.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★☆ | Scalability ★★★★★

### 8.2 Pest & Disease Detection via Computer Vision
- **Problem:** Rice, coffee, and fruit crops suffer major losses to pests; small farmers lack expert diagnosis.
- **AI Integration:** Smartphone photo → CNN classification (ResNet/EfficientNet) of pest/disease type → treatment recommendation + severity assessment.
- **Impact:** Early treatment; 20–40% reduction in crop loss.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★☆ | Scalability ★★★★★

### 8.3 Precision Irrigation & Fertigation Recommender
- **Problem:** Over-irrigation wastes water (critical in drought-prone regions); under-fertilisation reduces yield.
- **AI Integration:** IoT sensor data (soil moisture, NPK, pH) + weather forecast → ML-optimised watering and fertilisation schedule per crop type.
- **Impact:** 30–50% water savings; optimal fertiliser use.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★☆ | Scalability ★★★★★

### 8.4 Agricultural Supply Chain Traceability Platform
- **Problem:** Vietnamese exports (coffee, seafood, rice) face traceability requirements from EU/ US markets.
- **AI Integration:** Blockchain + AI: computer vision to log product conditions at each supply chain node; anomaly detection for quality breaks; automated compliance document generation.
- **Impact:** Export market access; premium pricing.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★☆ | 48h ★★★☆☆ | Scalability ★★★★★

### 8.5 Climate-Adaptive Crop Selection Advisory
- **Problem:** Climate change is shifting growing zones; farmers don't know which crops will thrive.
- **AI Integration:** ML matching historical + projected climate data to crop suitability profiles → personalised planting recommendations per farm.
- **Impact:** Climate resilience; maintained farmer livelihoods.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★☆ | Scalability ★★★★★

### 8.6 Livestock Health Monitoring via Audio/Video
- **Problem:** Poultry and pig diseases spread fast in Vietnamese farms; early signs are missed.
- **AI Integration:** Audio analysis (coughing/chirping patterns) + thermal camera video → anomaly detection for respiratory diseases → early alert.
- **Impact:** Reduced mortality; lower antibiotic use.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★☆☆ | Scalability ★★★★★

### 8.7 Smart Aquaculture: Water Quality Prediction & Automation
- **Problem:** Shrimp and fish farmers suffer mass die-offs from undetected water quality changes.
- **AI Integration:** Time-series model predicting DO (dissolved oxygen), pH, temperature, and ammonia levels → automated aeration/feeding triggers.
- **Impact:** 30–50% mortality reduction in ponds.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★☆ | Scalability ★★★★★

### 8.8 AI Marketplace Matching Farmers to Buyers
- **Problem:** Farmers sell to middlemen at low prices; lack direct market access.
- **AI Integration:** Matching algorithm connecting farmer produce (quality, quantity, harvest date) to buyer demand (restaurants, processors, exporters) with price recommendation.
- **Impact:** 20–40% higher farmer income.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★★ | Scalability ★★★★★

### 8.9 Farm Equipment Predictive Maintenance
- **Problem:** Tractor and harvester breakdowns during harvest season cause massive losses.
- **AI Integration:** Sensor + engine data → anomaly detection → remaining-useful-life prediction → maintenance scheduling before peak season.
- **Impact:** Zero unplanned downtime during harvest.
- **Scoring Alignment:** Real-world ★★★★☆ | AI-native ★★★★★ | 48h ★★★★☆ | Scalability ★★★★★

### 8.10 Automated Land Use Classification from Satellite Data
- **Problem:** Government lacks real-time data on crop types, deforestation, and land use changes.
- **AI Integration:** Semantic segmentation (U-Net/Swin) on Sentinel/Landsat imagery to classify land use: rice paddies, aquaculture, forest, urban, fallow.
- **Impact:** Policy intelligence; subsidy accuracy; environmental monitoring.
- **Scoring Alignment:** Real-world ★★★★★ | AI-native ★★★★★ | 48h ★★★★☆ | Scalability ★★★★★

---

# Appendix: Rapid Reference — Best Scoring Topics per Track

| Track | Top Pick (Best Score Potential) | Why |
|-------|-------------------------------|-----|
| Banking & Finance | 1.1 Alternative Credit Scoring | Immediate bank need, SHB as sponsor, financial inclusion narrative |
| Healthcare | 2.1 AI ER Triage | Lives saved, Vietnamese hospital pain point, feasible MVP |
| Education | 3.1 Adaptive Knowledge Tracing | Personalised learning at scale, strong pedagogical AI core |
| Disaster Prevention | 4.5 Social Media Disaster Mining | Rich data source (Facebook/Zalo), real-time, high impact |
| Innovation | 5.1 AI Prototype Validation | Universal startup pain, easy demo, market need |
| SME Productivity | 6.2 Automated Bookkeeping | Every SME needs this, OCR + LLM is mature, clear ROI |
| Smart Government | 7.1 Multi-Lingual Public Chatbot | Ethnic minority inclusion, strong social impact narrative |
| Agriculture | 8.2 Pest/Disease CV Detection | Smartphone-based, immediate farmer pain, proven tech |

---

*Research compiled 17 July 2026 from official VAIC 2026 sources, press coverage, and domain analysis.*
