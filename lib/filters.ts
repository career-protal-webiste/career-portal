// lib/filters.ts
// Wide STEM-friendly role matcher (0–5 yrs friendly, but doesn't block >5 if title is junior/mid/associate)

const STEM_KEYWORDS = [
  // SWE / Systems / Cloud
  'software engineer','software developer','swe','backend','front[- ]?end','full[- ]?stack','mobile','ios','android',
  'platform engineer','systems engineer','distributed systems','api developer','golang','java developer','typescript','react developer',
  'site reliability','sre','devops','cloud engineer','aws','azure','gcp','kubernetes','k8s','terraform',
  // Data / AI / Analytics
  'data engineer','analytics engineer','etl','elt','data platform','spark','dbt','snowflake','databricks','redshift',
  'big data','hadoop','kafka','airflow','glue','lakehouse','delta lake',
  'data analyst','bi analyst','business intelligence','power bi','tableau','looker','sql developer',
  'ml engineer','mlops','ai engineer','machine learning','nlp','computer vision','llm','applied scientist','data scientist',
  // Security / IT
  'security engineer','security analyst','soc analyst','iam','grc','threat detection','appsec','cloud security',
  'it support','help desk','desktop support',
  // QA / Test
  'qa engineer','quality assurance','test automation','sdet','quality engineer',
  // Embedded / Hardware / VLSI
  'embedded engineer','firmware','embedded systems','dsp','fpga','rtl','asic','verification','uvm','eda','hardware engineer','board design',
  // Electrical / Electronics / Power
  'electrical engineer','electronics engineer','power electronics','analog','digital design',
  // Mechanical / Industrial / Manufacturing / Process / Quality
  'mechanical engineer','industrial engineer','manufacturing engineer','mechatronics','controls engineer','automation engineer',
  'process engineer','quality engineer','reliability engineer','cad','solidworks','autocad','fea','cfd','gd&t',
  // Civil / Structural
  'civil engineer','structural engineer','transportation engineer','geotechnical',
  // Robotics / Aerospace
  'robotics','aerospace engineer',
  // Chemical / Biomedical / Materials
  'chemical engineer','biomedical engineer','bioengineer','materials engineer','material science'
];

// Exclude clearly senior/leadership roles (we target 0–5 yrs feel)
const EXCLUDE_SENIOR = [
  'senior','\\bsr\\.?\\b','staff','principal','lead','architect','manager','director','head of','vp','vice president','chief'
];

function toRe(list: string[]) {
  return new RegExp(`(${list.join('|')})`, 'i');
}

const STEM_RE = toRe(STEM_KEYWORDS);
const EXCLUDE_RE = toRe(EXCLUDE_SENIOR);

export function roleMatchesWide(title: string, desc?: string | null): boolean {
  const blob = `${title || ''} ${desc || ''}`.toLowerCase();
  if (!blob) return false;

  // must match any STEM role keyword
  if (!STEM_RE.test(blob)) return false;

  // allow “senior” only if explicitly junior/associate/new-grad appears (keeps some useful mid roles)
  if (EXCLUDE_RE.test(blob) && !/\b(junior|jr\.|associate|new grad|graduate|early career|mid)\b/i.test(blob)) {
    return false;
  }
  return true;
}
