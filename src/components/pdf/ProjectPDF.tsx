import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { LOGO_ESCAE_BASE64, LOGO_HUB_BASE64 } from "./pdfLogos";

const styles = StyleSheet.create({
  page: {
    paddingTop: 88,
    paddingBottom: 92,
    paddingHorizontal: 44,
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
    color: "#17221a",
    fontSize: 10,
    lineHeight: 1.45,
  },
  runningHeader: {
    position: "absolute",
    top: 24,
    left: 44,
    right: 44,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1.5,
    borderBottomColor: "#1e6b37",
    paddingBottom: 8,
  },
  logoEscae: { width: 58, height: 38, objectFit: "contain" },
  logoHub: { width: 39, height: 38, objectFit: "contain" },
  headerCenter: { flex: 1, textAlign: "center", paddingHorizontal: 10 },
  institutionName: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#173d24",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  institutionSub: { marginTop: 2, fontSize: 7, color: "#56615a" },
  documentName: {
    marginTop: 4,
    fontSize: 8,
    fontWeight: "bold",
    color: "#1e6b37",
    textTransform: "uppercase",
    letterSpacing: 0.55,
  },
  titleBlock: { marginBottom: 17, paddingBottom: 11, borderBottomWidth: 1, borderBottomColor: "#dce4dd" },
  eyebrow: { fontSize: 8, fontWeight: "bold", color: "#587061", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
  projectTitle: { fontSize: 18, lineHeight: 1.2, fontWeight: "bold", color: "#17221a", marginBottom: 8 },
  projectMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  reference: { fontSize: 8.5, color: "#59655d" },
  status: { fontSize: 8, fontWeight: "bold", color: "#1e6b37", textTransform: "uppercase" },
  section: { marginBottom: 14 },
  sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 7 },
  sectionNumber: { width: 22, fontSize: 9, fontWeight: "bold", color: "#1e6b37", marginRight: 5 },
  sectionTitle: { flex: 1, fontSize: 9, fontWeight: "bold", color: "#244b30", textTransform: "uppercase", letterSpacing: 0.45 },
  sectionRule: { width: 36, borderBottomWidth: 1, borderBottomColor: "#dce4dd", marginLeft: 8 },
  infoList: { borderTopWidth: 1, borderTopColor: "#e7ece8" },
  infoRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e7ece8", paddingVertical: 5 },
  infoLabel: { width: "31%", paddingRight: 8, fontSize: 9, color: "#657168" },
  infoValue: { flex: 1, fontSize: 9.5, color: "#17221a" },
  bodyText: { fontSize: 10, lineHeight: 1.5, color: "#28352c", textAlign: "justify" },
  subheading: { marginTop: 5, marginBottom: 3, fontSize: 9, fontWeight: "bold", color: "#354d3c" },
  teamList: { borderTopWidth: 1, borderTopColor: "#dce4dd" },
  teamRow: { flexDirection: "row", alignItems: "flex-start", borderBottomWidth: 1, borderBottomColor: "#e7ece8", paddingVertical: 6 },
  teamName: { width: "52%", paddingRight: 8, fontSize: 9.5, fontWeight: "bold", color: "#27372b" },
  teamRole: { flex: 1, fontSize: 9, color: "#59655d" },
  footerText: {
    position: "absolute",
    top: 814,
    left: 44,
    right: 44,
    borderTopWidth: 1,
    borderTopColor: "#dce4dd",
    paddingTop: 6,
    fontSize: 7.5,
    color: "#657168",
    textAlign: "center",
  },
  signatureSpacer: { flexGrow: 1, minHeight: 12 },
  signatures: {
    borderTopWidth: 1,
    borderTopColor: "#cbd7cd",
    paddingTop: 9,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 62,
  },
  signatureColumn: { width: "44%", alignItems: "center" },
  signatureLabel: { fontSize: 8.5, fontWeight: "bold", color: "#46554a", textAlign: "center", marginBottom: 27 },
  signatureLine: { width: "84%", borderBottomWidth: 1, borderBottomColor: "#89968c" },
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
    profiles?: {
      full_name?: string | null;
      email?: string | null;
      department?: string | null;
      student_id?: string | null;
    } | {
      full_name?: string | null;
      email?: string | null;
      department?: string | null;
      student_id?: string | null;
    }[];
  };
  teamMembers: { name: string; role_in_project: string }[];
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  submitted: "Soumis",
  admin_review: "Vérification administrative",
  corrections_requested: "Corrections demandées",
  under_review: "En examen",
  jury_evaluation: "Évaluation du jury",
  director_validation: "Validation de la direction",
  accepted_for_presentation: "Accepté pour présentation",
  scheduling: "Planification",
  presentation_done: "Présentation effectuée",
  final_decision: "Décision finale",
  approved: "Approuvé",
  rejected: "Refusé",
  under_re_examination: "En réexamen",
  postponed: "Reporté",
  cancelled: "Annulé",
};

function Section({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader} wrap={false}>
        <Text style={styles.sectionNumber}>{String(number).padStart(2, "0")}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionRule} />
      </View>
      {children}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow} wrap={false}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export function ProjectPDF({ project, teamMembers }: ProjectPDFProps) {
  const owner = Array.isArray(project.profiles) ? project.profiles[0] : project.profiles;
  const status = STATUS_LABELS[project.status] ?? project.status.replaceAll("_", " ");
  const submissionDate = new Date(project.created_at).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric",
  });

  return (
    <Document title={`Fiche projet - ${project.title}`} author="ESCAE-BÉNIN Innovation Hub" language="fr-FR">
      <Page size="A4" style={styles.page}>
        <View style={styles.runningHeader}>
          <Image src={LOGO_ESCAE_BASE64} style={styles.logoEscae} />
          <View style={styles.headerCenter}>
            <Text style={styles.institutionName}>ESCAE-BÉNIN</Text>
            <Text style={styles.institutionSub}>École Supérieure de Commerce et d’Administration des Entreprises</Text>
            <Text style={styles.documentName}>Innovation Hub · Fiche descriptive de projet</Text>
          </View>
          <Image src={LOGO_HUB_BASE64} style={styles.logoHub} />
        </View>

        <View style={styles.titleBlock} wrap={false}>
          <Text style={styles.eyebrow}>Dossier de projet étudiant</Text>
          <Text style={styles.projectTitle}>{project.title}</Text>
          <View style={styles.projectMeta}>
            <Text style={styles.reference}>Référence HUB-{project.id.slice(0, 8).toUpperCase()} · Déposé le {submissionDate}</Text>
            <Text style={styles.status}>{status}</Text>
          </View>
        </View>

        <Section number={1} title="Identification du porteur">
          <View style={styles.infoList}>
            <InfoRow label="Nom et prénom(s)" value={owner?.full_name ?? "Non renseigné"} />
            <InfoRow label="Matricule étudiant" value={owner?.student_id ?? "Non renseigné"} />
            <InfoRow label="Filière / département" value={owner?.department ?? "Non renseigné"} />
            <InfoRow label="Adresse e-mail" value={owner?.email ?? "Non renseignée"} />
            {project.budget !== null && project.budget !== undefined && (
              <InfoRow label="Budget estimatif" value={`${Number(project.budget).toLocaleString("fr-FR").replace(/[\u202f\u00a0]/g, " ")} FCFA`} />
            )}
          </View>
        </Section>

        <Section number={2} title="Composition de l’équipe">
          <View style={styles.teamList}>
            <View style={styles.teamRow} wrap={false}>
              <Text style={styles.teamName}>{owner?.full_name ?? "Étudiant porteur"}</Text>
              <Text style={styles.teamRole}>Porteur principal du projet</Text>
            </View>
            {teamMembers.map((member, index) => (
              <View key={`${member.name}-${index}`} style={styles.teamRow} wrap={false}>
                <Text style={styles.teamName}>{member.name}</Text>
                <Text style={styles.teamRole}>{member.role_in_project}</Text>
              </View>
            ))}
          </View>
        </Section>

        <Section number={3} title="Synthèse et description générale">
          <Text style={styles.bodyText}>{project.description?.trim() || "Aucune description renseignée."}</Text>
        </Section>

        {project.objectives?.trim() && (
          <Section number={4} title="Objectifs visés">
            <Text style={styles.bodyText}>{project.objectives.trim()}</Text>
          </Section>
        )}

        {(project.problem?.trim() || project.solution?.trim()) && (
          <Section number={5} title="Problématique et solution proposée">
            {project.problem?.trim() && (
              <>
                <Text style={styles.subheading}>Problème identifié</Text>
                <Text style={styles.bodyText}>{project.problem.trim()}</Text>
              </>
            )}
            {project.solution?.trim() && (
              <>
                <Text style={styles.subheading}>Solution et proposition de valeur</Text>
                <Text style={styles.bodyText}>{project.solution.trim()}</Text>
              </>
            )}
          </Section>
        )}

        {(project.feasibility?.trim() || project.impact?.trim()) && (
          <View style={styles.section}>
            <View wrap={false}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionNumber}>06</Text>
                <Text style={styles.sectionTitle}>Faisabilité et impact attendu</Text>
                <View style={styles.sectionRule} />
              </View>
              {project.feasibility?.trim() ? (
                <Text style={styles.subheading}>Faisabilité technique et opérationnelle</Text>
              ) : project.impact?.trim() ? (
                <Text style={styles.subheading}>Impact académique, économique et sociétal</Text>
              ) : null}
            </View>
            {project.feasibility?.trim() && (
              <Text style={styles.bodyText}>{project.feasibility.trim()}</Text>
            )}
            {project.impact?.trim() && (
              <>
                {project.feasibility?.trim() && <Text style={styles.subheading}>Impact académique, économique et sociétal</Text>}
                <Text style={styles.bodyText}>{project.impact.trim()}</Text>
              </>
            )}
          </View>
        )}

        <View style={styles.signatureSpacer} />
        <View style={styles.signatures} wrap={false}>
          <View style={styles.signatureColumn}>
            <Text style={styles.signatureLabel}>Signature du porteur de projet</Text>
            <View style={styles.signatureLine} />
          </View>
          <View style={styles.signatureColumn}>
            <Text style={styles.signatureLabel}>Visa du jury / comité ESCAE Hub</Text>
            <View style={styles.signatureLine} />
          </View>
        </View>

        <Text
          fixed
          style={styles.footerText}
          render={({ pageNumber, totalPages }) => `ESCAE-BÉNIN Innovation Hub  |  Document institutionnel  |  Page ${pageNumber} / ${totalPages}`}
        />
      </Page>
    </Document>
  );
}
