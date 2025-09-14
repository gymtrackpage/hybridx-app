// src/components/markdown-renderer.tsx
'use client';

import ReactMarkdown from 'react-markdown';

interface MarkdownRendererProps {
    content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
    return (
        <div className="prose prose-lg dark:prose-invert max-w-none">
            <ReactMarkdown
                components={{
                    h1: ({node, ...props}) => <h1 className="text-3xl font-bold mb-4" {...props} />,
                    h2: ({node, ...props}) => <h2 className="text-2xl font-semibold mt-6 mb-3" {...props} />,
                    h3: ({node, ...props}) => <h3 className="text-xl font-semibold mt-4 mb-2" {...props} />,
                    p: ({node, ...props}) => <p className="leading-relaxed mb-4" {...props} />,
                    ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-2" {...props} />,
                    ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-4 space-y-2" {...props} />,
                    li: ({node, ...props}) => <li className="mb-1" {...props} />,
                    strong: ({node, ...props}) => <strong className="font-bold" {...props} />,
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}
