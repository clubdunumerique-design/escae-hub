import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { LOGO_ESCAE_BASE64, LOGO_HUB_BASE64 } from './pdfLogos';

// Utility: truncate text to N words, append ellipsis if cut
function truncateWords(text: string | null | undefined, maxWords: number): string {
  if (!text) return '';
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text.trim();
  return words.slice(0, maxWords).join(' ') + '…';
}

function wasTruncated(text: string | null | undefined, maxWords: number): boolean {
  if (!text) return false;
  return text.trim().split(/\s+/).length > maxWords;
}

// Word limits per field
const WORD_LIMITS = {
  description: 120,
  objectives: 80,
  problem: 80,
  solution: 80,
  feasibility: 60,
  impact: 60,
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 24,
    paddingBottom: 40,
    paddingHorizontal: 38,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
    color: '#1a1a1a',
    fontSize: 9,
    lineHeight: 1.38,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#074015',
    marginBottom: 12,
  },
  logoLeft: { width: 60, height: 42, objectFit: 'contain' },
  logoRight: { width: 52, height: 46, objectFit: 'contain' },
  headerCenter: { flex: 1, textAlign: 'center', paddingHorizontal: 10 },
  institutionName: {
    fontSize: 9.5, fontWeight: 'bold', color: '#074015',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 1,
  },
  institutionSub: { fontSize: 7, color: '#4a5568', marginBottom: 3 },
  documentBadge: {
    fontSize: 10, fontWeight: 'bold', color: '#03A61C',
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  projectTitleBox: {
    backgroundColor: '#f7faf7',
    borderLeftWidth: 4, borderLeftColor: '#03A61C',
    borderTopWidth: 1, borderTopColor: '#e2e8f0',
    borderRightWidth: 1, borderRightColor: '#e2e8f0',
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
    padding: 8, marginBottom: 10, borderRadius: 2,
  },
  projectTitle: { fontSize: 13, fontWeight: 'bold', color: '#074015', marginBottom: 3 },
  projectSubtitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  projectRef: { fontSize: 7.5, color: '#718096' },
  statusBadge: {
    backgroundColor: '#e6f4ea', color: '#074015', fontSize: 7.5,
    fontWeight: 'bold', paddingVertical: 2, paddingHorizontal: 5,
    borderRadius: 3, textTransform: 'uppercase',
  },
  section: { marginBottom: 9 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#074015',
    paddingVertical: 3, paddingHorizontal: 6, borderRadius: 2, marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 8.5, fontWeight: 'bold', color: '#ffffff',
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  sectionBody: { paddingHorizontal: 2 },
  metaGrid: {
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 3,
    marginBottom: 9, overflow: 'hidden',
  },
  metaRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#edf2f7' },
  metaRowLast: { flexDirection: 'row' },
  metaCellLabel: {
    width: '28%', backgroundColor: '#f8fafc', paddingVertical: 3.5,
    paddingHorizontal: 7, fontSize: 8, fontWeight: 'bold', color: '#4a5568',
    borderRightWidth: 1, borderRightColor: '#edf2f7',
  },
  metaCellValue: {
    width: '72%', paddingVertical: 3.5, paddingHorizontal: 7,
    fontSize: 8.5, color: '#1a202c',
  },
  paragraph: {
    fontSize: 8.5, color: '#2d3748', lineHeight: 1.38,
    textAlign: 'justify', marginBottom: 3,
  },
  teamTable: {
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 3,
    overflow: 'hidden', marginTop: 1,
  },
  teamTableHeader: {
    flexDirection: 'row', backgroundColor: '#f1f5f9',
    borderBottomWidth: 1, borderBottomColor: '#cbd5e1',
    paddingVertical: 3, paddingHorizontal: 7,
  },
  teamTableRow: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
    paddingVertical: 3, paddingHorizontal: 7,
  },
  teamColName: { width: '55%', fontSize: 8, fontWeight: 'bold', color: '#1a202c' },
  teamColRole: { width: '45%', fontSize: 8, color: '#4a5568' },
  signatureBox: {
    marginTop: 10, paddingTop: 7, borderTopWidth: 1, borderTopColor: '#cbd5e1',
    flexDirection: 'row', justifyContent: 'space-between',
  },
  signatureCol: { width: '45%', textAlign: 'center' },
  signatureTitle: {
    fontSize: 7.5, fontWeight: 'bold', color: '#4a5568',
    marginBottom: 20, textTransform: 'uppercase',
  },
  signatureLine: { borderBottomWidth: 1, borderBottomColor: '#a0aec0', marginHorizontal: 15 },
  truncationNote: {
    fontSize: 7, color: '#a0aec0', fontStyle: 'italic',
    textAlign: 'right', marginTop: 2, marginBottom: 4,
  },
  footer: {
    position: 'absolute', bottom: 14, left: 38, right: 38,
    borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 5,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    fontSize: 7, color: '#718096',
  },
  footerLeft: { flex: 1 },
  footerRight: { textAlign: 'right' },
});

interface ProjectPDFProps {
  project: {
    id: string;
    title: string;
    status: string;
    description: string;
    objectives?: string | null;
    problem: string | null;
    solution: string | null;
    feasibility: string | null;
    impact: string | null;
    budget: number | null;
    created_at: string;
    updated_at?: string;
    profiles?: {
      full_name?: string | null;
      email?: string | null;
      department?: string | null;
      student_id?: string | null;
      is_verified?: boolean | null;
    } | {
      full_name?: string | null;
      email?: string | null;
      department?: string | null;
      student_id?: string | null;
      is_verified?: boolean | null;
    }[];
  };
  teamMembers: { name: string; role_in_project: string }[];
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  submitted: "Soumis",
  under_review: "En cours d'evaluation",
  needs_revision: "A reviser",
  validated: "Valide",
  rejected: "Rejete",
};

export function ProjectPDF({ project, teamMembers }: ProjectPDFProps) {
  const owner = Array.isArray(project.profiles) ? project.profiles[0] : project.profiles;
  const statusFr = STATUS_LABELS[project.status] || project.status.toUpperCase();
  const submissionDate = new Date(project.created_at).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const descText    = truncateWords(project.description, WORD_LIMITS.description);
  const objText     = truncateWords(project.objectives,  WORD_LIMITS.objectives);
  const problemText = truncateWords(project.problem,     WORD_LIMITS.problem);
  const solutText   = truncateWords(project.solution,    WORD_LIMITS.solution);
  const feasText    = truncateWords(project.feasibility, WORD_LIMITS.feasibility);
  const impactText  = truncateWords(project.impact,      WORD_LIMITS.impact);

  const anyTruncated =
    wasTruncated(project.description, WORD_LIMITS.description) ||
    wasTruncated(project.objectives,  WORD_LIMITS.objectives)  ||
    wasTruncated(project.problem,     WORD_LIMITS.problem)     ||
    wasTruncated(project.solution,    WORD_LIMITS.solution)    ||
    wasTruncated(project.feasibility, WORD_LIMITS.feasibility) ||
    wasTruncated(project.impact,      WORD_LIMITS.impact);

  return (
    <Document title={`Fiche Projet - ${project.title}`} author="ESCAE-BENIN Innovation Hub">
      <Page size="A4" style={styles.page}>

        <View style={styles.headerContainer}>
          <Image src={LOGO_ESCAE_BASE64} style={styles.logoLeft} />
          <View style={styles.headerCenter}>
            <Text style={styles.institutionName}>ESCAE-BENIN</Text>
            <Text style={styles.institutionSub}>ECOLE SUPERIEURE DE COMMERCE ET D'ADMINISTRATION DES ENTREPRISES</Text>
            <Text style={styles.documentBadge}>INNOVATION HUB - FICHE DESCRIPTIVE DE PROJET</Text>
          </View>
          <Image src={LOGO_HUB_BASE64} style={styles.logoRight} />
        </View>

        <View style={styles.projectTitleBox}>
          <Text style={styles.projectTitle}>{project.title}</Text>
          <View style={styles.projectSubtitleRow}>
            <Text style={styles.projectRef}>
              Ref. : HUB-{project.id.slice(0, 8).toUpperCase()} - Date de depot : {submissionDate}
            </Text>
            <Text style={styles.statusBadge}>Statut : {statusFr}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>1. Identification de l'Etudiant Porteur et Metadonnees</Text>
          </View>
          <View style={styles.metaGrid}>
            <View style={styles.metaRow}>
              <Text style={styles.metaCellLabel}>Nom et Prenom(s) :</Text>
              <Text style={styles.metaCellValue}>{owner?.full_name ?? 'Non specifie'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaCellLabel}>Matricule Etudiant :</Text>
              <Text style={styles.metaCellValue}>{owner?.student_id ?? 'Non renseigne'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaCellLabel}>Filiere / Departement :</Text>
              <Text style={styles.metaCellValue}>{owner?.department ?? 'Non renseigne'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaCellLabel}>Courriel officiel :</Text>
              <Text style={styles.metaCellValue}>{owner?.email ?? 'Non renseigne'}</Text>
            </View>
            {project.budget !== null && project.budget !== undefined && (
              <View style={styles.metaRowLast}>
                <Text style={styles.metaCellLabel}>Budget estimatif :</Text>
                <Text style={styles.metaCellValue}>
                  {Number(project.budget).toLocaleString('fr-FR')} FCFA
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>2. Composition de l'Equipe</Text>
          </View>
          <View style={styles.teamTable}>
            <View style={styles.teamTableHeader}>
              <Text style={styles.teamColName}>Nom complet</Text>
              <Text style={styles.teamColRole}>Role / Attribution dans le projet</Text>
            </View>
            <View style={styles.teamTableRow}>
              <Text style={styles.teamColName}>{owner?.full_name ?? 'Etudiant porteur'}</Text>
              <Text style={styles.teamColRole}>Porteur principal du projet (Lead)</Text>
            </View>
            {teamMembers.map((member, index) => (
              <View key={index} style={styles.teamTableRow}>
                <Text style={styles.teamColName}>{member.name}</Text>
                <Text style={styles.teamColRole}>{member.role_in_project}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>3. Synthese et Description Generale</Text>
          </View>
          <View style={styles.sectionBody}>
            <Text style={styles.paragraph}>{descText || 'Aucune description renseignee.'}</Text>
          </View>
        </View>

        {objText ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>4. Objectifs Vises</Text>
            </View>
            <View style={styles.sectionBody}>
              <Text style={styles.paragraph}>{objText}</Text>
            </View>
          </View>
        ) : null}

        {(problemText || solutText) ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>5. Problematique et Solution Proposee</Text>
            </View>
            <View style={styles.sectionBody}>
              {problemText ? (
                <>
                  <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#074015', marginBottom: 2 }}>
                    Probleme identifie :
                  </Text>
                  <Text style={styles.paragraph}>{problemText}</Text>
                </>
              ) : null}
              {solutText ? (
                <>
                  <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#074015', marginTop: 3, marginBottom: 2 }}>
                    Solution et proposition de valeur :
                  </Text>
                  <Text style={styles.paragraph}>{solutText}</Text>
                </>
              ) : null}
            </View>
          </View>
        ) : null}

        {(feasText || impactText) ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>6. Faisabilite et Impact Attendu</Text>
            </View>
            <View style={styles.sectionBody}>
              {feasText ? (
                <>
                  <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#074015', marginBottom: 2 }}>
                    Faisabilite technique et operationnelle :
                  </Text>
                  <Text style={styles.paragraph}>{feasText}</Text>
                </>
              ) : null}
              {impactText ? (
                <>
                  <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#074015', marginTop: 3, marginBottom: 2 }}>
                    Impact academique, economique et societal :
                  </Text>
                  <Text style={styles.paragraph}>{impactText}</Text>
                </>
              ) : null}
            </View>
          </View>
        ) : null}

        {anyTruncated ? (
          <Text style={styles.truncationNote}>
            * Certains contenus ont ete resumes pour respecter la limite d'espace du document. Le texte complet est disponible sur la plateforme.
          </Text>
        ) : null}

        <View style={styles.signatureBox}>
          <View style={styles.signatureCol}>
            <Text style={styles.signatureTitle}>Signature du porteur de projet</Text>
            <View style={styles.signatureLine} />
          </View>
          <View style={styles.signatureCol}>
            <Text style={styles.signatureTitle}>Visa du Jury / Comite ESCAE Hub</Text>
            <View style={styles.signatureLine} />
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerLeft}>
            ESCAE-BENIN Innovation Hub - Plateforme academique officielle d'innovation
          </Text>
          <Text
            style={styles.footerRight}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`}
          />
        </View>

      </Page>
    </Document>
  );
}
