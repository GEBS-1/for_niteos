import refsData from "../../data/projectReferences.json";

export interface ProjectReference {
  id: string;
  title: string;
  url: string;
  buildingType: string;
  task: string;
  fixtureIds: string[];
  defaultPromptIds: string[];
  lightingSummary: string;
  promptHint: string;
}

export const PROJECT_REFERENCES: ProjectReference[] = refsData as ProjectReference[];

export function getProjectReference(id: string): ProjectReference | undefined {
  return PROJECT_REFERENCES.find((p) => p.id === id);
}

export function projectsForFixture(fixtureId: string): ProjectReference[] {
  return PROJECT_REFERENCES.filter((p) => p.fixtureIds.includes(fixtureId));
}
