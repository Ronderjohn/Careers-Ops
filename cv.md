# CV — Abhay Santhani

**Location:** Hyderabad, India  
**Email:** abhaysanthani@gmail.com  
**Phone:** +91-8374162770  
**LinkedIn:** [linkedin.com/in/abhay-santhani](https://linkedin.com/in/abhay-santhani)  
**GitHub:** [https://github.com/Ronderjohn](https://github.com/Ronderjohn)

## Professional Summary

Applied AI Engineer with 2+ years of experience building production LLM systems across pharma, finance, and enterprise automation. Specialises in end-to-end LLM data pipelines, agentic AI frameworks (LangGraph, AutoGen), and domain adaptation of large language models (3B–70B). Proven track record shipping live AI products — from a deployed finance intelligence platform used by real analysts to an agentic QA framework that eliminated the bulk of manual testing effort. Seeking to bring deep hands-on AI engineering experience to a high-impact product team.

## Work Experience

### Tekframeworks — AI/ML Engineer (Product)
**Sep 2025 – Present | Hyderabad, India**

**FoRMLM — Pharma & finance domain LLM data infrastructure**

- Architected an end-to-end LLM training data pipeline processing 500+ GB of regulatory pharmaceutical corpora (US FDA, EMA, ICH guidelines), transforming raw documents into LoRA fine-tuning-ready datasets for 3B–70B models.
- Built a layout-aware PDF ingestion engine using PyMuPDF (Fitz) to parse complex regulatory PDFs and XML filings, preserving semantic structure (tables, sections, headers) for high-fidelity LLM training data.
- Designed a data quality framework: duplicate/near-duplicate detection and content sanity checks (empty chunks, garbled text, encoding errors) for contamination-controlled corpora at scale.
- Built S3-based data versioning and lifecycle management for reproducible dataset iterations across domain adaptation experiments.
- Developed a GPT-4o-powered synthetic SFT Q&A generation pipeline from regulatory source material to improve downstream DAPT model performance.
- Processed a sample PubMed corpus in parallel to validate pipeline generalisability across biomedical literature and establish cross-domain reuse patterns.

**SparLM — Finance analyst intelligence platform (live product)**

- Co-built (two-engineer team) the full AI backend of SparLM — a live platform used by financial analysts — for automated month-on-month report generation from pitch decks and earnings call transcripts.
- Designed document retrieval and prompt-orchestration using Qdrant with open-source sentence-transformer embeddings for semantically accurate multi-document retrieval.
- Built a cross-document inconsistency detection system powered by a large Qwen-family LLM, surfacing contradictions between management guidance in call transcripts and filed annual reports.
- Delivered structured PDF outputs with source-traceable LLM insights for analysts and frontend consumption.
- Contributed to PostgreSQL schema design for document metadata, analytical outputs, and end-to-end source-to-insight traceability.

### Agivant Technologies — Machine Learning Engineer (Solutions)
**Nov 2024 – Aug 2025**

**Executive Insight Generator — Agentic finance AI (POC)**

- Engineered the LangGraph orchestration layer for a multi-agent system integrating Gemini and GPT models to generate CXO-level financial insights from enterprise datasets, reducing manual analyst effort by ~90%.
- Operationalised insight delivery via Microsoft Fabric Data Agents for scalable real-time report generation in enterprise POC demos.

**Agentic QA automation framework — E-commerce web testing**

- Built an end-to-end agentic QA framework: agent logic, Selenium/Playwright automation, and test orchestration with LangGraph for autonomous e-commerce flow validation.
- Achieved ~70% reduction in manual testing effort (QA team estimate) after deployment.

**Audio intelligence & GenAI query system — Sales intelligence**

- Built a context-aware audio intelligence stack: transcription, semantic chunking, and GenAI querying over long sales calls to surface buyer intent at scale.

### Geon — Data Scientist Intern (R&D)
**Apr 2024 – Oct 2024**

- Owned battery ML end-to-end: SoC and State of Health (SoH) models at 80%+ accuracy, ETL for sensor data, and automated performance dashboards from scratch.
- Replaced a month-long manual plant testing workflow with an ML inference pipeline producing equivalent health assessments in under 10 minutes (~99% cycle-time reduction).
- Built ETL with imputation, outlier handling, and feature engineering across 20+ battery datasets to improve model accuracy and stability.
- Delivered dashboards for real-time battery metrics for plant management.

### Indian Institute of Tropical Meteorology (IITM) — Machine Learning Engineer Intern (R&D)
**Jan 2024 – Mar 2024**

- Deployed ML models at 82% accuracy on a public meteorological platform, expanding access for ~40% more users.
- Implemented ETL and feature engineering for meteorological data on High-Performance Computational Systems (HPCS).
- Restructured legacy models for forward compatibility, cutting model update cycles by ~15%.

## Projects

**MemoryFolio** — Python, PyTorch, deep learning  
Face recognition and clustering with CNNs (VGG, FaceNet); ~85% identification accuracy on an academic dataset through tuning and preprocessing.

**CERN di-electron collision analysis** — Python, unsupervised ML  
Applied Self-Organising Maps (SOM), Restricted Boltzmann Machines (RBM), and Isolation Forest to CERN Open Data LHC collision data to detect anomalous high-energy particle events.

## Skills

- **Languages:** Python, SQL, Bash  
- **LLM & agentic:** LangGraph, AutoGen, Google ADK, MCP, prompt engineering, LoRA, DAPT, SFT  
- **AI / ML:** LLMs, domain adaptation, NLP, deep learning, time series, supervised & unsupervised learning  
- **Data engineering:** Medallion architecture, ETL, vector databases (Qdrant), tokenisation, sharding, AWS S3  
- **Frameworks & tools:** PyTorch, TensorFlow, PyMuPDF, Flask, Spark, Docker, Streamlit, Selenium, Playwright  
- **Databases:** PostgreSQL, MySQL, Qdrant  
- **Cloud:** AWS (S3), Azure (Microsoft Fabric), GCP  
- **Visualisation:** Tableau, Power BI  

## Education

**Vijaybhoomi University** — B.Tech in Artificial Intelligence  
Sep 2020 – Oct 2024  
CGPA: 8.76 / 10.0 | Dean’s Medal for Outstanding Academic Performance

## Certifications & achievements

- Qualified GATE Data Science & AI (2024)  
- Salesforce AgentForce — corporate certification  
- Salesforce Cloud Data Admin — corporate certification  
- Predictive Business Analytics — Coursera  
