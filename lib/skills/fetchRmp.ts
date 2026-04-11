/**
 * Skill: fetchRmp
 *
 * Pulls a professor's reviews from Rate My Professor's unofficial GraphQL
 * endpoint. RMP has no public API, so we use the same endpoint their site
 * uses with the well-known "test:test" basic auth token. The token can be
 * overridden via the RMP_AUTH_TOKEN env var so it can be rotated without
 * a code change.
 *
 * Pipeline:
 *   1. resolveSchoolId(universityName) → base64 schoolID
 *   2. resolveTeacher(name, schoolId)  → base64 teacherID
 *   3. fetchRatings(teacherId)         → ratings + comments
 *
 * Any failure → returns null. Wrap with withTimeout() at the call site.
 */
import { withTimeout } from "./_shared/timeout";

const RMP_ENDPOINT = "https://www.ratemyprofessors.com/graphql";
const RMP_AUTH = process.env.RMP_AUTH_TOKEN ?? "dGVzdDp0ZXN0"; // base64("test:test")
const RMP_TIMEOUT_MS = 5000;

export interface RmpInput {
  professorName: string;
  universityName: string;
}

export interface RmpOutput {
  professorName: string;
  schoolName: string;
  score: number;
  numRatings: number;
  wouldTakeAgain: number | null;
  difficulty: number | null;
  recentComments: string[];
  tags: string[];
  profileUrl: string | null;
}

async function rmpRequest<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(RMP_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${RMP_AUTH}`,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`RMP HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(`RMP GraphQL: ${JSON.stringify(json.errors)}`);
  return json.data as T;
}

interface SchoolSearchResult {
  newSearch: {
    schools: {
      edges: { node: { id: string; name: string; city: string; state: string } }[];
    };
  };
}

async function resolveSchoolId(name: string): Promise<{ id: string; displayName: string } | null> {
  const data = await rmpRequest<SchoolSearchResult>(
    `query SchoolSearch($query: SchoolSearchQuery!) {
       newSearch {
         schools(query: $query) {
           edges { node { id name city state } }
         }
       }
     }`,
    { query: { text: name } }
  );
  const edges = data.newSearch?.schools?.edges ?? [];
  if (!edges.length) return null;
  const node = edges[0].node;
  return { id: node.id, displayName: `${node.name} · ${node.city}, ${node.state}` };
}

interface TeacherSearchResult {
  newSearch: {
    teachers: {
      edges: {
        node: {
          id: string;
          firstName: string;
          lastName: string;
          avgRating: number;
          numRatings: number;
          wouldTakeAgainPercent: number;
          avgDifficulty: number;
          school: { name: string };
          legacyId: number;
        };
      }[];
    };
  };
}

async function resolveTeacher(
  professorName: string,
  schoolId: string
): Promise<TeacherSearchResult["newSearch"]["teachers"]["edges"][number]["node"] | null> {
  const data = await rmpRequest<TeacherSearchResult>(
    `query TeacherSearch($query: TeacherSearchQuery!) {
       newSearch {
         teachers(query: $query) {
           edges {
             node {
               id legacyId firstName lastName avgRating numRatings
               wouldTakeAgainPercent avgDifficulty
               school { name }
             }
           }
         }
       }
     }`,
    { query: { text: professorName, schoolID: schoolId } }
  );
  const edges = data.newSearch?.teachers?.edges ?? [];
  if (!edges.length) return null;
  // Pick the one with the most ratings (best signal for the right person)
  const best = [...edges].sort((a, b) => b.node.numRatings - a.node.numRatings)[0];
  return best.node;
}

interface TeacherRatingsResult {
  node: {
    ratings: {
      edges: {
        node: {
          comment: string;
          ratingTags: string;
          qualityRating: number;
          difficultyRatingRounded: number;
          date: string;
        };
      }[];
    };
  };
}

async function fetchRatings(teacherId: string): Promise<TeacherRatingsResult["node"]["ratings"]["edges"]> {
  const data = await rmpRequest<TeacherRatingsResult>(
    `query TeacherRatings($id: ID!) {
       node(id: $id) {
         ... on Teacher {
           ratings(first: 20) {
             edges {
               node {
                 comment ratingTags qualityRating difficultyRatingRounded date
               }
             }
           }
         }
       }
     }`,
    { id: teacherId }
  );
  return data.node?.ratings?.edges ?? [];
}

async function fetchRmpInner(input: RmpInput): Promise<RmpOutput | null> {
  const school = await resolveSchoolId(input.universityName);
  if (!school) return null;

  const teacher = await resolveTeacher(input.professorName, school.id);
  if (!teacher) return null;

  const ratings = await fetchRatings(teacher.id);

  const recentComments = ratings
    .map((r) => r.node.comment?.trim())
    .filter((c): c is string => !!c)
    .slice(0, 8);

  const tagCounts = new Map<string, number>();
  for (const r of ratings) {
    const tagsRaw = r.node.ratingTags ?? "";
    for (const t of tagsRaw.split("--").map((s) => s.trim()).filter(Boolean)) {
      tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    }
  }
  const tags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([t]) => t);

  return {
    professorName: `${teacher.firstName} ${teacher.lastName}`,
    schoolName: teacher.school?.name ?? school.displayName,
    score: teacher.avgRating ?? 0,
    numRatings: teacher.numRatings ?? 0,
    wouldTakeAgain:
      typeof teacher.wouldTakeAgainPercent === "number" && teacher.wouldTakeAgainPercent >= 0
        ? teacher.wouldTakeAgainPercent
        : null,
    difficulty:
      typeof teacher.avgDifficulty === "number" && teacher.avgDifficulty > 0
        ? teacher.avgDifficulty
        : null,
    recentComments,
    tags,
    profileUrl: teacher.legacyId
      ? `https://www.ratemyprofessors.com/professor/${teacher.legacyId}`
      : null,
  };
}

export async function fetchRmp(input: RmpInput): Promise<RmpOutput | null> {
  return withTimeout(fetchRmpInner(input), RMP_TIMEOUT_MS);
}
