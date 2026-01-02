import React from 'react';
import { LatexRenderer } from './LatexRenderer';
import { AnnotationLayer } from './AnnotationLayer';
import { StepRevealRenderer } from './StepRevealRenderer';
import { QuestionNode } from '../shared/types';

interface PrintViewProps {
    questions: QuestionNode[];
    annotations: Record<number, any[]>;
    cachedTikZ: Record<string, string>;
    basePath: string;
}

export const PrintView: React.FC<PrintViewProps> = ({ questions, annotations, cachedTikZ, basePath }) => {
    return (
        <div className="print-view bg-white min-h-screen p-0 m-0">
            {questions.map((q, idx) => (
                <div key={idx} className="print-page relative w-full h-auto min-h-[100vh] p-8 border-b border-gray-100 flex flex-col" style={{ breakAfter: 'page' }}>
                    {/* Slide Header */}
                    <div className="mb-6 pb-2 border-b-2 border-indigo-100 flex justify-between items-center">
                        <h2 className="text-2xl font-bold text-indigo-700">DẠNG {idx + 1}</h2>
                        <span className="text-gray-400 text-sm">{q.question_type}</span>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 relative">
                        <div className="latex-content-container relative z-10">
                            <LatexRenderer
                                content={q.content}
                                cachedImages={cachedTikZ}
                                theme="light"
                                basePath={basePath}
                            />

                            {/* Options for Multiple Choice */}
                            {q.question_type !== 'tra_loi_ngan' && q.options && (
                                <div className="grid grid-cols-2 gap-4 mt-6">
                                    {q.options.map((opt: any, oIdx: number) => (
                                        <div key={oIdx} className="p-3 border rounded-lg flex gap-3 items-start">
                                            <span className="w-8 h-8 rounded-full border bg-gray-50 flex items-center justify-center font-bold flex-shrink-0">
                                                {opt.id}
                                            </span>
                                            <div className="pt-0.5">
                                                <LatexRenderer content={opt.content} cachedImages={cachedTikZ} theme="light" basePath={basePath} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Solution Area */}
                            {q.explanation && (
                                <div className="mt-8 p-6 bg-slate-50 rounded-xl border border-slate-200">
                                    <div className="font-bold text-lg mb-2 text-indigo-600">Lời giải chi tiết:</div>
                                    <StepRevealRenderer
                                        content={q.explanation}
                                        isOpen={true}
                                        isActive={true}
                                        cachedImages={cachedTikZ}
                                        theme="light"
                                        basePath={basePath}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Annotations Overlay */}
                        <div className="absolute inset-0 z-20 pointer-events-none">
                            <AnnotationLayer
                                isActive={false}
                                onClose={() => { }}
                                initialPaths={annotations[idx]}
                                slideId={idx}
                            />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};
