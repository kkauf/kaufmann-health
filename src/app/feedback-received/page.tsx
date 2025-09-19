import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-static';
export const revalidate = 3600;

export default function Page() {
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Vielen Dank für dein Feedback</CardTitle>
          <CardDescription>Deine Rückmeldung hilft uns, unseren Service zu verbessern.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Wir kümmern uns darum. Wenn du möchtest, kannst du einfach auf die E‑Mail antworten und uns Details mitteilen.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
