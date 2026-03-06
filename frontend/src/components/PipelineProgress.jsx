import { FiCpu, FiBookOpen, FiGlobe, FiZap, FiCheck, FiDatabase, FiSave, FiAlertCircle } from "react-icons/fi";

const STAGES = [
    { label: "Retrieving Relevant Memory", icon: <FiDatabase /> },
    { label: "Planning Research Strategy", icon: <FiCpu /> },
    { label: "Analyzing Plan", icon: <FiBookOpen /> },
    { label: "Gathering External Knowledge", icon: <FiGlobe /> },
    { label: "Generating Research Report", icon: <FiZap /> },
    { label: "Saving Knowledge to Memory", icon: <FiSave /> },
];

export default function PipelineProgress({ active, steps = [], paused = false }) {
    if (!active && !paused) return null;

    let currentStage = 0;
    if (steps.length > 0) {
        const lastStep = steps[steps.length - 1];
        const index = STAGES.findIndex(s => s.label === lastStep.stage);
        if (index !== -1) {
            currentStage = index;
        }
    }

    return (
        <div className="pipeline-progress">
            <div className="pipeline-track">
                {STAGES.map((stage, i) => {
                    const isCompleted = i < currentStage;
                    const isActive = i === currentStage;

                    return (
                        <div
                            key={i}
                            className={`pipeline-stage ${isCompleted ? "completed" : isActive ? "active" : "pending"}`}
                        >
                            <div className={`stage-dot ${paused && isActive ? "paused" : ""}`}>
                                {isCompleted ? <FiCheck /> : paused && isActive ? <FiAlertCircle /> : stage.icon}
                            </div>
                            <span className="stage-label">{stage.label}</span>
                            {i < STAGES.length - 1 && (
                                <div className={`stage-connector ${isCompleted ? "filled" : ""}`} />
                            )}
                        </div>
                    );
                })}
            </div>
            <div className="pipeline-pulse">
                {paused ? (
                    <>
                        <FiAlertCircle className="pulse-icon paused-icon" style={{ marginRight: 8, color: '#f59e0b' }} />
                        <span style={{ color: '#f59e0b', fontWeight: 500 }}>Agent requires clarification before proceeding.</span>
                    </>
                ) : (
                    <>
                        <div className="pulse-dot" />
                        <span>Agent is working...</span>
                    </>
                )}
            </div>
        </div>
    );
}
