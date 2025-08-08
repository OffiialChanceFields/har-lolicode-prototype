import React from 'react';
import { SessionAnalysisResult } from '@/services/session/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface SessionAnalysisViewProps {
  sessionAnalysis: SessionAnalysisResult;
}

export const SessionAnalysisView: React.FC<SessionAnalysisViewProps> = ({ sessionAnalysis }) => {
  if (!sessionAnalysis) {
    return null;
  }

  return (
    <Card className="bg-gradient-glow border-border/50 p-6 shadow-elevation">
      <CardHeader>
        <CardTitle>Session Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {sessionAnalysis.sessions.map((session) => (
            <AccordionItem value={session.id} key={session.id}>
              <AccordionTrigger>{`Session ${session.id}`}</AccordionTrigger>
              <AccordionContent>
                <div>
                  <h4 className="font-semibold">Cookies:</h4>
                  <ul>
                    {session.cookies.map((cookie) => (
                      <li key={cookie.name}>{`${cookie.name}: ${cookie.value}`}</li>
                    ))}
                  </ul>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
};
