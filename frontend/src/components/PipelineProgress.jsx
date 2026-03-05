import { useState, useEffect } from "react";
import { FiCpu, FiBookOpen, FiGlobe, FiZap, FiCheck } from "react-icons/fi";

const STAGES = [
    { label: "Planning research...", icon: <FiCpu /> },
    { label: "Analyzing knowledge sources...", icon: <FiBookOpen /> },
    { label: "Gathering external sources...", icon: <FiGlobe /> },
    { label: "Synthesizing report...", icon: <FiZap /> },
];

export default function PipelineProgress({ active }) {
    const [currentStage, setCurrentStage] = useState(0);

    useEffect(() => {
        if (!active) {
            setCurrentStage(0);
            return;
        }

        const interval = setInterval(() => {
            setCurrentStage((prev) => {
                if (prev < STAGES.length - 1) return prev + 1;
                return prev;
            });
        }, 3500);

        return () => clearInterval(interval);
    }, [active]);

    if (!active) return null;

    return (
        <div className="pipeline-progress">
            <div className="pipeline-track">
                {STAGES.map((stage, i) => (
                    <div
                        key={i}
                        className={`pipeline-stage ${i < currentStage
                            ? "completed"
                            : i === currentStage
                                ? "active"
                                : "pending"
                            }`}
                    >
                        <div className="stage-dot">
                            {i < currentStage ? <FiCheck /> : stage.icon}
                        </div>
                        <span className="stage-label">{stage.label}</span>
                        {i < STAGES.length - 1 && (
                            <div
                                className={`stage-connector ${i < currentStage ? "filled" : ""
                                    }`}
                            />
                        )}
                    </div>
                ))}
            </div>
            <div className="pipeline-pulse">
                <div className="pulse-dot" />
                <span>Agent is working...</span>
            </div>
        </div>
    );
}
