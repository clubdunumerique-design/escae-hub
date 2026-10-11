import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { LOGO_ESCAE_BASE64, LOGO_HUB_BASE64 } from './pdfLogos';

const styles = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 45,
    paddingHorizontal: 40,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
    color: '#1a1a1a',
    fontSize: 9.5,
    lineHeight: 1.45,
  },
  // --- EN-TÊTE OFFICIEL INSTITUTIONNEL ---
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: '#074015',
    marginBottom: 16,
  },
  logoLeft: {
    width: 68,
    height: 48,
    objectFit: 'contain',
  },
  logoRight: {
    width: 58,
    height: 52,
    objectFit: 'contain',
  },
  headerCenter: {
    flex: 1,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  institutionName: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#074015',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  institutionSub: {
    fontSize: 7.5,
    color: '#4a5568',
    marginBottom: 4,
  },
  documentBadge: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#03A61C',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // --- TITRE DU PROJET ---
  projectTitleBox: {
    backgroundColor: '#f7faf7',
    borderLeftWidth: 4,
    borderLeftColor: '#03A61C',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    padding: 10,
    marginBottom: 14,
    borderRadius: 2,
  },
  projectTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#074015',
    marginBottom: 4,
  },
  projectSubtitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  projectRef: {
    fontSize: 8,
    color: '#718096',
  },
  statusBadge: {
    backgroundColor: '#e6f4ea',
    color: '#074015',
    fontSize: 8,
    fontWeight: 'bold',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    textTransform: 'uppercase',
  },

  // --- SECTIONS DU DOCUMENT ---
  section: {
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#074015',
    paddingVertical: 3.5,
    paddingHorizontal: 7,
    borderRadius: 2,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionBody: {
    paddingHorizontal: 2,
  },

  // --- GRILLE D'INFORMATIONS ÉTUDIANT & PROJET ---
  metaGrid: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 3,
    marginBottom: 12,
    overflow: 'hidden',
  },
  metaRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#edf2f7',
  },
  metaRowLast: {
    flexDirection: 'row',
  },
  metaCellLabel: {
    width: '28%',
    backgroundColor: '#f8fafc',
    paddingVertical: 4.5,
    paddingHorizontal: 8,
    fontSize: 8.5,
    fontWeight: 'bold',
    color: '#4a5568',
    borderRightWidth: 1,
    borderRightColor: '#edf2f7',
  },
  metaCellValue: {
    width: '72%',
    paddingVertical: 4.5,
    paddingHorizontal: 8,
    fontSize: 9,
    color: '#1a202c',
  },

  // --- PARAGRAPHES TEXTUELS ---
  paragraph: {
    fontSize: 9,
    color: '#2d3748',
    lineHeight: 1.45,
    textAlign: 'justify',
    marginBottom: 4,
  },

  // --- TABLEAU ÉQUIPE ---
  teamTable: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 2,
  },
  teamTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  teamTableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  teamColName: {
    width: '55%',
    fontSize: 8.5,
    fontWeight: 'bold',
    color: '#1a202c',
  },
  teamColRole: {
    width: '45%',
    fontSize: 8.5,
    color: '#4a5568',
  },

  // --- CADRE DE VALIDATION / ÉMARGEMENT ---
  signatureBox: {
    marginTop: 14,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#cbd5e1',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signatureCol: {
    width: '45%',
    textAlign: 'center',
  },
  signatureTitle: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#4a5568',
    marginBottom: 24,
    textTransform: 'uppercase',
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#a0aec0',
    marginHorizontal: 15,
  },

  // --- PIED DE PAGE ---
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 7.5,
    color: '#718096',
  },
  footerLeft: {
    flex: 1,
  },
  footerRight: {
    textAlign: 'right',
  },
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
  under_review: "En cours d'évaluation",
  needs_revision: "À réviser",
  validated: "Validé",
  rejected: "Rejeté",
};

export function ProjectPDF({ project, teamMembers }: ProjectPDFProps) {
  const owner = Array.isArray(project.profiles) ? project.profiles[0] : project.profiles;
  const statusFr = STATUS_LABELS[project.status] || project.status.toUpperCase();
  const submissionDate = new Date(project.created_at).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <Document title={`Fiche Projet - ${project.title}`} author="ESCAE-BÉNIN Innovation Hub">
      <Page size="A4" style={styles.page}>
        
        {/* EN-TÊTE INSTITUTIONNEL AVEC LES DEUX LOGOS */}
        <View style={styles.headerContainer}>
          <Image src={LOGO_ESCAE_BASE64} style={styles.logoLeft} />
          
          <View style={styles.headerCenter}>
            <Text style={styles.institutionName}>ESCAE-BÉNIN</Text>
            <Text style={styles.institutionSub}>ÉCOLE SUPÉRIEURE DE COMMERCE ET D'ADMINISTRATION DES ENTREPRISES</Text>
            <Text style={styles.documentBadge}>INNOVATION HUB — FICHE DESCRIPTIVE DE PROJET</Text>
          </View>

          <Image src={LOGO_HUB_BASE64} style={styles.logoRight} />
        </View>

        {/* CADRE TITRE ET STATUT */}
        <View style={styles.projectTitleBox}>
          <Text style={styles.projectTitle}>{project.title}</Text>
          <View style={styles.projectSubtitleRow}>
            <Text style={styles.projectRef}>
              Réf. : HUB-{project.id.slice(0, 8).toUpperCase()} • Date de dépôt : {submissionDate}
            </Text>
            <Text style={styles.statusBadge}>Statut : {statusFr}</Text>
          </View>
        </View>

        {/* CADRE IDENTIFICATION DE L'ÉTUDIANT ET MÉTADONNÉES */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>1. Identification de l'Étudiant Porteur & Métadonnées</Text>
          </View>
          <View style={styles.metaGrid}>
            <View style={styles.metaRow}>
              <Text style={styles.metaCellLabel}>Nom et Prénom(s) :</Text>
              <Text style={styles.metaCellValue}>{owner?.full_name ?? 'Non spécifié'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaCellLabel}>Matricule Étudiant :</Text>
              <Text style={styles.metaCellValue}>{owner?.student_id ?? 'Non renseigné'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaCellLabel}>Filière / Département :</Text>
              <Text style={styles.metaCellValue}>{owner?.department ?? 'Non renseigné'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaCellLabel}>Courriel officiel :</Text>
              <Text style={styles.metaCellValue}>{owner?.email ?? 'Non renseigné'}</Text>
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

        {/* ÉQUIPE DU PROJET */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>2. Composition de l'Équipe</Text>
          </View>
          <View style={styles.teamTable}>
            <View style={styles.teamTableHeader}>
              <Text style={styles.teamColName}>Nom complet</Text>
              <Text style={styles.teamColRole}>Rôle / Attribution dans le projet</Text>
            </View>
            <View style={styles.teamTableRow}>
              <Text style={styles.teamColName}>{owner?.full_name ?? 'Étudiant porteur'}</Text>
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

        {/* DESCRIPTION DU PROJET */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>3. Synthèse et Description Générale</Text>
          </View>
          <View style={styles.sectionBody}>
            <Text style={styles.paragraph}>{project.description || 'Aucune description renseignée.'}</Text>
          </View>
        </View>

        {/* OBJECTIFS DU PROJET */}
        {project.objectives && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>4. Objectifs Visés</Text>
            </View>
            <View style={styles.sectionBody}>
              <Text style={styles.paragraph}>{project.objectives}</Text>
            </View>
          </View>
        )}

        {/* PROBLÉMATIQUE ET SOLUTION */}
        {(project.problem || project.solution) && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>5. Problématique & Solution Proposée</Text>
            </View>
            <View style={styles.sectionBody}>
              {project.problem && (
                <>
                  <Text style={{ fontSize: 8.5, fontWeight: 'bold', color: '#074015', marginBottom: 2 }}>
                    Problème identifié :
                  </Text>
                  <Text style={styles.paragraph}>{project.problem}</Text>
                </>
              )}
              {project.solution && (
                <>
                  <Text style={{ fontSize: 8.5, fontWeight: 'bold', color: '#074015', marginTop: 4, marginBottom: 2 }}>
                    Solution et proposition de valeur :
                  </Text>
                  <Text style={styles.paragraph}>{project.solution}</Text>
                </>
              )}
            </View>
          </View>
        )}

        {/* FAISABILITÉ ET IMPACT */}
        {(project.feasibility || project.impact) && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>6. Faisabilité & Impact Attendu</Text>
            </View>
            <View style={styles.sectionBody}>
              {project.feasibility && (
                <>
                  <Text style={{ fontSize: 8.5, fontWeight: 'bold', color: '#074015', marginBottom: 2 }}>
                    Faisabilité technique et opérationnelle :
                  </Text>
                  <Text style={styles.paragraph}>{project.feasibility}</Text>
                </>
              )}
              {project.impact && (
                <>
                  <Text style={{ fontSize: 8.5, fontWeight: 'bold', color: '#074015', marginTop: 4, marginBottom: 2 }}>
                    Impact académique, économique et sociétal :
                  </Text>
                  <Text style={styles.paragraph}>{project.impact}</Text>
                </>
              )}
            </View>
          </View>
        )}

        {/* CADRE D'ÉMARGEMENT / SIGNATURES */}
        <View style={styles.signatureBox}>
          <View style={styles.signatureCol}>
            <Text style={styles.signatureTitle}>Signature du porteur de projet</Text>
            <View style={styles.signatureLine} />
          </View>
          <View style={styles.signatureCol}>
            <Text style={styles.signatureTitle}>Visa du Jury / Comité ESCAE Hub</Text>
            <View style={styles.signatureLine} />
          </View>
        </View>

        {/* PIED DE PAGE AUTOMATIQUE SUR CHAQUE FEUILLE */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerLeft}>
            ESCAE-BÉNIN Innovation Hub • Plateforme académique officielle d'innovation
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
