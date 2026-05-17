const Result = require('../models/Result');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Perform deep plagiarism analysis on an exam batch
 */
exports.analyzeExamPlagiarism = async (req, res) => {
    try {
        const { examId } = req.params;

        // 1. Fetch all results for this exam
        const results = await Result.find({ examId })
            .populate('userId', 'name usn department')
            .lean();

        if (results.length < 2) {
            return res.status(200).json({
                success: true,
                message: 'Insufficient submissions for comparative analysis',
                data: []
            });
        }

        // 2. Group coding answers by question
        const questionsMap = {}; // questionId -> [ { student, code } ]
        
        results.forEach(result => {
            result.answers.forEach(answer => {
                if (answer.type === 'coding' && answer.code) {
                    if (!questionsMap[answer.questionId]) {
                        questionsMap[answer.questionId] = [];
                    }
                    questionsMap[answer.questionId].push({
                        student: result.userId,
                        code: answer.code,
                        resultId: result._id
                    });
                }
            });
        });

        const plagiarismReports = [];

        // 3. Analyze each question group
        for (const [qId, submissions] of Object.entries(questionsMap)) {
            // Pairwise comparison (Heuristic first)
            for (let i = 0; i < submissions.length; i++) {
                for (let j = i + 1; j < submissions.length; j++) {
                    const sim = calculateSimilarity(submissions[i].code, submissions[j].code);
                    
                    if (sim > 0.6) { // 60% threshold for heuristic flag
                        plagiarismReports.push({
                            questionId: qId,
                            similarity: Math.round(sim * 100),
                            studentA: submissions[i].student,
                            studentB: submissions[j].student,
                            codeA: submissions[i].code,
                            codeB: submissions[j].code,
                            status: sim > 0.85 ? 'Critical' : 'High Risk'
                        });
                    }
                }
            }
        }

        // 4. Use AI to confirm top 3 most suspicious matches (to save tokens)
        const suspiciousMatches = plagiarismReports
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 5);

        for (const match of suspiciousMatches) {
            if (process.env.GEMINI_API_KEY) {
                try {
                    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                    const prompt = `
                    You are a Code Plagiarism Expert. Compare these two code snippets for the same problem.
                    Snippet A (by ${match.studentA.name}):
                    ${match.codeA}

                    Snippet B (by ${match.studentB.name}):
                    ${match.codeB}

                    Detect if this is "Coincidental" (common logic) or "Likely Plagiarism" (copied and modified).
                    Provide a "Confidence Score" (0-100) and a brief "Reasoning".
                    Respond ONLY with JSON: { "isPlagiarism": true/false, "confidence": 0, "reasoning": "" }
                    `;
                    
                    const result = await model.generateContent(prompt);
                    const response = await result.response;
                    const aiDecision = JSON.parse(response.text().match(/\{.*\}/s)[0]);
                    
                    match.aiAnalysis = aiDecision;
                } catch (e) {
                    console.error('AI Plagiarism Verification Failed:', e.message);
                }
            }
        }

        res.status(200).json({
            success: true,
            totalAnalyzed: submissionsCount(questionsMap),
            matchesFound: plagiarismReports.length,
            data: plagiarismReports
        });

    } catch (error) {
        console.error('Plagiarism Analysis Error:', error);
        res.status(500).json({ success: false, message: 'Plagiarism engine failure' });
    }
};

/**
 * Simple Token-based Jaccard Similarity
 */
function calculateSimilarity(code1, code2) {
    const tokenize = (c) => {
        return c.replace(/\s+/g, '') // Remove all whitespace
                .replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '') // Remove comments
                .split(/[^a-zA-Z0-9]/) // Split by non-alphanumeric
                .filter(t => t.length > 2); // Only keep tokens > 2 chars
    };

    const tokens1 = new Set(tokenize(code1));
    const tokens2 = new Set(tokenize(code2));

    const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
    const union = new Set([...tokens1, ...tokens2]);

    return intersection.size / union.size;
}

function submissionsCount(map) {
    return Object.values(map).reduce((acc, curr) => acc + curr.length, 0);
}
