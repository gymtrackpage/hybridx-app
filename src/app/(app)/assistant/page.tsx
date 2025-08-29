import type { Metadata } from 'next';
import { AssistantChat } from '@/components/assistant-chat';

export const metadata: Metadata = {
    title: 'AI Assistant | HyroxEdgeAI',
};

export default function AssistantPage() {
    return (
        <div className="h-full flex flex-col">
            <div className="mb-4">
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">AI Training Assistant</h1>
                <p className="text-muted-foreground">Ask questions about your training, nutrition, or race strategy.</p>
            </div>
            <AssistantChat />
        </div>
    );
}
