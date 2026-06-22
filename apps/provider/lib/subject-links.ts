export type ProviderSubjectLike = {
  subjectProfileId?: string | null;
  subjectLabel?: string | null;
  subjectRelationship?: string | null;
};

export function appendProviderSubjectParams(href: string, subject?: ProviderSubjectLike | null) {
  const subjectProfileId = String(subject?.subjectProfileId ?? '').trim();
  if (!subjectProfileId) return href;
  const [path, query = ''] = href.split('?');
  const params = new URLSearchParams(query);
  params.set('subjectProfileId', subjectProfileId);
  const subjectLabel = String(subject?.subjectLabel ?? '').trim();
  const subjectRelationship = String(subject?.subjectRelationship ?? '').trim();
  if (subjectLabel) params.set('subjectLabel', subjectLabel);
  if (subjectRelationship) params.set('subjectRelationship', subjectRelationship);
  const nextQuery = params.toString();
  return nextQuery ? `${path}?${nextQuery}` : path;
}
