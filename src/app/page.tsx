import { AssignmentsClient } from "./_components/assignments-client";
import { ExperimentsClient } from "./_components/experiments-client";
import { VariantsClient } from "./_components/variants-client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { HydrateClient, api } from "~/trpc/server";

export default async function Home() {
  await api.experiments.list.prefetch();

  return (
    <HydrateClient>
      <main className="min-h-screen bg-linear-to-br from-[#03030a] via-[#050310] to-[#010104] px-4 py-10 text-white sm:px-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
          <Tabs defaultValue="experiments">
            <TabsList>
              <TabsTrigger value="experiments">Experiments</TabsTrigger>
              <TabsTrigger value="variants">Variants</TabsTrigger>
              <TabsTrigger value="assignments">Assignments</TabsTrigger>
            </TabsList>
            <TabsContent value="experiments">
              <ExperimentsClient />
            </TabsContent>
            <TabsContent value="variants">
              <VariantsClient />
            </TabsContent>
            <TabsContent value="assignments">
              <AssignmentsClient />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </HydrateClient>
  );
}
