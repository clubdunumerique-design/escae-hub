import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Enregistrer des polices (optionnel, pour l'instant on utilise Helvetica natif pour la simplicité)
// Font.register({ family: 'Inter', src: '...' });

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#03A61C',
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#074015',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: '#666666',
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#03A61C',
    marginBottom: 8,
    backgroundColor: '#f0fdf4', // vert très clair
    padding: 5,
  },
  text: {
    fontSize: 11,
    color: '#333333',
    lineHeight: 1.5,
    textAlign: 'justify',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
    paddingVertical: 5,
  },
  colLabel: {
    width: '30%',
    fontSize: 10,
    fontWeight: 'bold',
    color: '#666666',
  },
  colValue: {
    width: '70%',
    fontSize: 11,
    color: '#333333',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    color: '#999999',
    fontSize: 9,
    borderTopWidth: 1,
    borderTopColor: '#eeeeee',
    paddingTop: 5,
  }
});

interface ProjectPDFProps {
  project: {
    id: string;
    title: string;
    status: string;
    description: string;
    problem: string | null;
    solution: string | null;
    feasibility: string | null;
    impact: string | null;
    budget: number | null;
    created_at: string;
    profiles?: any;
  };
  teamMembers: { name: string; role_in_project: string }[];
}

export function ProjectPDF({ project, teamMembers }: ProjectPDFProps) {
  const owner = Array.isArray(project.profiles) ? project.profiles[0] : project.profiles;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* En-tête */}
        <View style={styles.header}>
          <Text style={styles.title}>{project.title}</Text>
          <Text style={styles.subtitle}>
            Fiche projet — ESCAE-BÉNIN Innovation Hub
          </Text>
        </View>

        {/* Informations générales */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>INFORMATIONS GÉNÉRALES</Text>
          <View style={styles.row}>
            <Text style={styles.colLabel}>Porteur du projet :</Text>
            <Text style={styles.colValue}>{owner?.full_name ?? 'Inconnu'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.colLabel}>Département :</Text>
            <Text style={styles.colValue}>{owner?.department ?? 'Non renseigné'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.colLabel}>Date de soumission :</Text>
            <Text style={styles.colValue}>
              {new Date(project.created_at).toLocaleDateString('fr-FR')}
            </Text>
          </View>
          {project.budget !== null && (
            <View style={styles.row}>
              <Text style={styles.colLabel}>Budget estimé :</Text>
              <Text style={styles.colValue}>
                {Number(project.budget).toLocaleString('fr-FR')} FCFA
              </Text>
            </View>
          )}
        </View>

        {/* Équipe */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MEMBRES DE L'ÉQUIPE</Text>
          <View style={styles.row}>
            <Text style={styles.colLabel}>{owner?.full_name ?? 'Porteur'}</Text>
            <Text style={styles.colValue}>Porteur de projet (Owner)</Text>
          </View>
          {teamMembers.map((m, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.colLabel}>{m.name}</Text>
              <Text style={styles.colValue}>{m.role_in_project}</Text>
            </View>
          ))}
        </View>

        {/* Résumé */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RÉSUMÉ DU PROJET</Text>
          <Text style={styles.text}>{project.description}</Text>
        </View>

        {/* Problème */}
        {project.problem && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PROBLÈME IDENTIFIÉ</Text>
            <Text style={styles.text}>{project.problem}</Text>
          </View>
        )}

        {/* Solution */}
        {project.solution && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SOLUTION PROPOSÉE</Text>
            <Text style={styles.text}>{project.solution}</Text>
          </View>
        )}

        {/* Faisabilité (si présent) */}
        {project.feasibility && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>FAISABILITÉ ET RESSOURCES</Text>
            <Text style={styles.text}>{project.feasibility}</Text>
          </View>
        )}

        {/* Impact (si présent) */}
        {project.impact && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>IMPACT ATTENDU</Text>
            <Text style={styles.text}>{project.impact}</Text>
          </View>
        )}

        {/* Pied de page */}
        <Text style={styles.footer} fixed>
          Document généré par ESCAE-BÉNIN Innovation Hub — Page {`<pageNumber>`} / {`<totalPages>`}
        </Text>
      </Page>
    </Document>
  );
}
