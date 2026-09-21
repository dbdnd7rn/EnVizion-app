import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Switch, Text, View } from "react-native";
import {
  completeCarePacketExport,
  failCarePacketExport,
  loadCarePacketSupportingData,
  packetCareContactReference,
  packetDocumentReference,
  startCarePacketExport,
  type CarePacketExportRecord,
  type CarePacketRecipient,
} from "../carePacket";
import {
  buildCarePacketHtml,
  carePacketSectionLabels,
  carePacketTitle,
  type CarePacketSection,
  type CarePacketType,
} from "../carePacketHelpers";
import { transitionSteps } from "../content";
import { careContactCategoryLabels, type CareContact } from "../careContacts";
import type { CareDocument } from "../documents";
import { documentCategoryLabels, formatDocumentBytes } from "../documentHelpers";
import { printHtmlResource } from "../printing";
import type { CareReminder } from "../reminderHelpers";
import { useCare } from "../store";
import {
  Button,
  C,
  Card,
  Field,
  Heading,
  Icon,
  Page,
  S,
  Section,
  Txt,
} from "../ui";

const defaultSections: CarePacketSection[] = [
  "profile",
  "appointment",
  "medications",
  "observations",
  "reminders",
];

function Choice({
  title,
  selected,
  onPress,
}: {
  title: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        S.card,
        {
          flex: 1,
          minWidth: 145,
          padding: 15,
          borderColor: selected ? C.purple : C.line,
          backgroundColor: selected ? C.lavender : C.white,
        },
      ]}
    >
      <View style={S.row}>
        <Icon
          name={selected ? "checkmark-circle" : "ellipse-outline"}
          color={selected ? C.purple : C.muted}
          size={20}
        />
        <Text style={[S.h3, { flex: 1, fontSize: 13 }]}>{title}</Text>
      </View>
    </Pressable>
  );
}

function SectionToggle({
  section,
  enabled,
  disabled,
  onChange,
}: {
  section: CarePacketSection;
  enabled: boolean;
  disabled?: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const descriptions: Record<CarePacketSection, string> = {
    profile: "Care recipient name and relationship.",
    emergency_contact: "Saved emergency contact name and phone.",
    appointment: "Visit details, preparation notes, and questions.",
    medications: "Current active medication list.",
    medication_history: "Up to 10 recent caregiver-recorded medication entries.",
    observations: "Recent tracker entries you choose by count.",
    reminders: "Up to 10 active shared care reminders.",
    transition: "Hospital-to-home checklist status.",
    vault_documents: "A checklist of selected private documents to bring separately.",
    care_contacts: "Only the doctors, services, or organizations you select.",
  };

  return (
    <Card>
      <View style={S.between}>
        <View style={{ flex: 1, gap: 4, paddingRight: 14 }}>
          <Text style={S.h3}>{carePacketSectionLabels[section]}</Text>
          <Txt style={S.small}>{descriptions[section]}</Txt>
        </View>
        <Switch
          accessibilityLabel={carePacketSectionLabels[section]}
          value={enabled}
          disabled={disabled}
          onValueChange={onChange}
          trackColor={{ true: C.purple }}
        />
      </View>
    </Card>
  );
}

function statusLabel(status: CarePacketExportRecord["status"]) {
  if (status === "completed") return "Completed";
  if (status === "failed") return "Failed";
  return "Started";
}

export function CarePacketScreen() {
  const { state } = useCare();
  const [packetType, setPacketType] = useState<CarePacketType>("visit");
  const [selectedSections, setSelectedSections] =
    useState<CarePacketSection[]>(defaultSections);
  const [observationLimit, setObservationLimit] = useState(5);
  const [receiverNote, setReceiverNote] = useState("");
  const [recipient, setRecipient] = useState<CarePacketRecipient | null>(null);
  const [reminders, setReminders] = useState<CareReminder[]>([]);
  const [documents, setDocuments] = useState<CareDocument[]>([]);
  const [contacts, setContacts] = useState<CareContact[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [history, setHistory] = useState<CarePacketExportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");

  const careRecipientId = state.careRecipientId;
  const viewer = state.accessRole === "viewer";

  const refresh = useCallback(async () => {
    if (!careRecipientId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const data = await loadCarePacketSupportingData(careRecipientId);
      setRecipient(data.recipient);
      setReminders(data.reminders);
      setDocuments(data.documents);
      setContacts(data.contacts);
      setHistory(data.history);
      setSelectedDocumentIds((current) =>
        current.filter((id) => data.documents.some((document) => document.id === id)),
      );
      setSelectedContactIds((current) =>
        current.filter((id) => data.contacts.some((contact) => contact.id === id)),
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not prepare the packet builder.",
      );
    } finally {
      setLoading(false);
    }
  }, [careRecipientId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selectedSet = useMemo(
    () => new Set(selectedSections),
    [selectedSections],
  );

  const activeReminderCount = useMemo(
    () =>
      reminders.filter(
        (reminder) => !reminder.completedAt && !reminder.dismissedAt,
      ).length,
    [reminders],
  );

  const selectedDocuments = useMemo(
    () =>
      documents
        .filter((document) => selectedDocumentIds.includes(document.id))
        .map(packetDocumentReference),
    [documents, selectedDocumentIds],
  );

  const selectedContacts = useMemo(
    () =>
      contacts
        .filter((contact) => selectedContactIds.includes(contact.id))
        .map(packetCareContactReference),
    [contacts, selectedContactIds],
  );

  function toggleSection(section: CarePacketSection, enabled: boolean) {
    setSelectedSections((current) => {
      if (enabled) return current.includes(section) ? current : [...current, section];
      return current.filter((item) => item !== section);
    });

    if (section === "vault_documents" && !enabled) {
      setSelectedDocumentIds([]);
    }
    if (section === "care_contacts" && !enabled) {
      setSelectedContactIds([]);
    }
  }

  function toggleDocument(documentId: string) {
    setSelectedDocumentIds((current) =>
      current.includes(documentId)
        ? current.filter((id) => id !== documentId)
        : [...current, documentId],
    );
  }

  function toggleContact(contactId: string) {
    setSelectedContactIds((current) =>
      current.includes(contactId)
        ? current.filter((id) => id !== contactId)
        : [...current, contactId],
    );
  }

  async function exportPacket() {
    if (!careRecipientId || !recipient || viewer || exporting) return;
    if (!selectedSections.length) {
      setMessage("Choose at least one section before creating a packet.");
      return;
    }

    if (selectedSet.has("care_contacts") && selectedContactIds.length === 0) {
      setMessage(
        "Choose at least one care contact, or turn off the care contacts section.",
      );
      return;
    }

    if (
      selectedSet.has("vault_documents") &&
      selectedDocumentIds.length === 0
    ) {
      setMessage(
        "Choose at least one Care Vault document, or turn off the document checklist section.",
      );
      return;
    }

    setExporting(true);
    setMessage("");
    let packetId: string | null = null;

    try {
      const started = await startCarePacketExport({
        careRecipientId,
        packetType,
        sections: selectedSections,
        selectedDocumentIds,
        selectedContactIds,
        observationLimit,
      });
      packetId = started.packetId;

      const html = buildCarePacketHtml({
        packetType,
        generatedAt: new Date().toISOString(),
        careRecipient: recipient,
        appointment: state.appointment,
        questions: state.questions,
        medications: state.medications,
        medicationRecords: state.medicationRecords,
        entries: state.entries,
        reminders,
        transitionSteps,
        transitionCompleted: state.transition,
        selectedDocuments,
        careContacts: selectedContacts,
        selectedSections,
        observationLimit,
        receiverNote,
      });

      await printHtmlResource(carePacketTitle(packetType), html);
      await completeCarePacketExport(packetId);

      setMessage(
        Platform.OS === "web"
          ? "The print/save window completed. EnVizion recorded the packet export workflow."
          : "The PDF share workflow completed and was recorded in the care audit history.",
      );
      await refresh();
    } catch (error) {
      if (packetId) {
        try {
          await failCarePacketExport(packetId);
        } catch {
          // Preserve the original export error for the user.
        }
      }

      setMessage(
        error instanceof Error
          ? error.message
          : "We could not create this care packet.",
      );
      await refresh();
    } finally {
      setExporting(false);
    }
  }

  if (!careRecipientId) {
    return (
      <Page>
        <Heading
          eyebrow="HANDOFF & VISIT PACKET"
          title="Choose a care profile first."
        />
        <Card>
          <Txt>
            Set up or select a care profile before preparing a portable care
            conversation packet.
          </Txt>
        </Card>
      </Page>
    );
  }

  return (
    <Page>
      <Heading
        eyebrow="HANDOFF & VISIT PACKET"
        title="Share only what this conversation needs."
        body="Build a focused PDF from the active care profile. Nothing is included unless you choose it."
      />

      <Card style={{ backgroundColor: C.deep, borderWidth: 0 }}>
        <Text style={[S.eyebrow, { color: "#E7CFEF" }]}>ACTIVE CARE PROFILE</Text>
        <Text style={[S.h2, { color: C.white }]}>
          {state.careRecipientName || "Care profile"}
        </Text>
        <Txt style={{ color: "#E9DDED" }}>
          {state.accessRole === "owner"
            ? "Owner"
            : state.accessRole === "caregiver"
              ? "Caregiver"
              : "Viewer"}{" "}
          access
        </Txt>
      </Card>

      {Boolean(message) && (
        <Card>
          <Text accessibilityRole="alert" style={S.body}>
            {message}
          </Text>
        </Card>
      )}

      {viewer && (
        <Card style={{ backgroundColor: C.lavender }}>
          <Icon name="eye-outline" />
          <Text style={S.h3}>Viewer access cannot create portable packets.</Text>
          <Txt>
            You can review the shared care record in EnVizion, but packet export
            is limited to the Owner and Caregiver roles.
          </Txt>
        </Card>
      )}

      <Section title="1. Choose the packet" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <Choice
          title="Visit preparation"
          selected={packetType === "visit"}
          onPress={() => setPacketType("visit")}
        />
        <Choice
          title="Caregiver handoff"
          selected={packetType === "handoff"}
          onPress={() => setPacketType("handoff")}
        />
      </View>

      <Section title="2. Privacy controls" />
      {(
        [
          "profile",
          "emergency_contact",
          "appointment",
          "medications",
          "medication_history",
          "observations",
          "reminders",
          "transition",
          "care_contacts",
          "vault_documents",
        ] as CarePacketSection[]
      ).map((section) => (
        <SectionToggle
          key={section}
          section={section}
          enabled={selectedSet.has(section)}
          disabled={exporting}
          onChange={(enabled) => toggleSection(section, enabled)}
        />
      ))}

      {selectedSet.has("observations") && (
        <Card>
          <Text style={S.h3}>How many recent observations?</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {[3, 5, 10, 20].map((count) => (
              <Pressable
                key={count}
                accessibilityRole="radio"
                accessibilityState={{ selected: observationLimit === count }}
                disabled={exporting}
                onPress={() => setObservationLimit(count)}
                style={[
                  S.pill,
                  {
                    minHeight: 42,
                    minWidth: 62,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor:
                      observationLimit === count ? C.purple : C.lavender,
                  },
                ]}
              >
                <Text
                  style={[
                    S.h3,
                    {
                      fontSize: 12,
                      color: observationLimit === count ? C.white : C.deep,
                    },
                  ]}
                >
                  {count}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>
      )}

      {selectedSet.has("care_contacts") && (
        <>
          <Section title="3. Care contacts to include" />
          <Card style={{ backgroundColor: C.lavender }}>
            <Txt>
              Select only the providers relevant to this visit or handoff. The
              rest of the directory stays private to the care profile.
            </Txt>
          </Card>

          {contacts.length ? (
            contacts.map((contact) => {
              const selected = selectedContactIds.includes(contact.id);
              return (
                <Pressable
                  key={contact.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  disabled={exporting}
                  onPress={() => toggleContact(contact.id)}
                  style={[
                    S.card,
                    {
                      borderColor: selected ? C.purple : C.line,
                      backgroundColor: selected ? "#F6F0F8" : C.white,
                      opacity: exporting ? 0.6 : 1,
                    },
                  ]}
                >
                  <View style={S.between}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={S.h3}>{contact.providerName}</Text>
                      <Txt style={S.small}>
                        {careContactCategoryLabels[contact.category]}
                        {contact.specialty ? ` · ${contact.specialty}` : ""}
                        {contact.organizationName
                          ? ` · ${contact.organizationName}`
                          : ""}
                      </Txt>
                      {Boolean(contact.phone || contact.email) && (
                        <Text style={S.small}>
                          {[contact.phone, contact.email]
                            .filter(Boolean)
                            .join(" · ")}
                        </Text>
                      )}
                    </View>
                    <Icon
                      name={selected ? "checkmark-circle" : "ellipse-outline"}
                      color={selected ? C.purple : C.muted}
                    />
                  </View>
                </Pressable>
              );
            })
          ) : (
            <Card>
              <Icon name="call-outline" />
              <Text style={S.h3}>No provider contacts saved yet.</Text>
              <Txt>
                Add doctors, pharmacy, insurance, or other care contacts in the
                provider directory before including them in a packet.
              </Txt>
            </Card>
          )}
        </>
      )}

      {selectedSet.has("vault_documents") && (
        <>
          <Section
            title={`${selectedSet.has("care_contacts") ? "4" : "3"}. Documents to bring or share separately`}
          />
          <Card style={{ backgroundColor: C.lavender }}>
            <Txt>
              Selected documents are listed in the packet as an attachment
              checklist. Their private file contents are not copied into the
              generated PDF. Open or download them separately from Care Vault
              when appropriate.
            </Txt>
          </Card>

          {documents.length ? (
            documents.map((document) => {
              const selected = selectedDocumentIds.includes(document.id);
              return (
                <Pressable
                  key={document.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  disabled={exporting}
                  onPress={() => toggleDocument(document.id)}
                  style={[S.card, S.row, { padding: 16 }]}
                >
                  <Icon
                    name={selected ? "checkmark-circle" : "ellipse-outline"}
                    color={selected ? C.purple : C.muted}
                  />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={S.h3}>{document.displayName}</Text>
                    <Txt style={S.small}>
                      {documentCategoryLabels[document.category]} ·{" "}
                      {formatDocumentBytes(document.sizeBytes)}
                    </Txt>
                  </View>
                </Pressable>
              );
            })
          ) : (
            <Card>
              <Txt>
                No Care Vault documents are available for this care profile.
              </Txt>
            </Card>
          )}
        </>
      )}

      <Section
        title={`${
          3 +
          Number(selectedSet.has("care_contacts")) +
          Number(selectedSet.has("vault_documents"))
        }. Optional note`}
      />
      <Field
        label="Note for the receiving caregiver or healthcare team"
        value={receiverNote}
        onChange={(value) => setReceiverNote(value.slice(0, 1200))}
        multiline
      />
      <Txt style={S.small}>
        This note is placed in the PDF but is not stored in the packet-history
        recipe.
      </Txt>

      <Section title="Packet preview" />
      <Card>
        <Text style={S.h2}>{carePacketTitle(packetType)}</Text>
        <Txt>
          {selectedSections.length} section
          {selectedSections.length === 1 ? "" : "s"} selected.
        </Txt>
        {selectedSet.has("observations") && (
          <Txt>{Math.min(observationLimit, state.entries.length)} recent observation(s).</Txt>
        )}
        {selectedSet.has("medications") && (
          <Txt>{state.medications.length} active medication(s).</Txt>
        )}
        {selectedSet.has("reminders") && (
          <Txt>{Math.min(activeReminderCount, 10)} active reminder(s).</Txt>
        )}
        {selectedSet.has("care_contacts") && (
          <Txt>{selectedContactIds.length} care contact(s) included.</Txt>
        )}
        {selectedSet.has("vault_documents") && (
          <Txt>{selectedDocumentIds.length} vault document(s) listed separately.</Txt>
        )}
      </Card>

      {loading ? (
        <Card>
          <ActivityIndicator color={C.purple} />
          <Txt>Preparing packet options…</Txt>
        </Card>
      ) : (
        <Button
          title={
            exporting
              ? "Preparing secure packet…"
              : Platform.OS === "web"
                ? "Print or save packet as PDF"
                : "Create & share packet PDF"
          }
          icon="document-text-outline"
          disabled={
            viewer ||
            exporting ||
            !recipient ||
            selectedSections.length === 0
          }
          onPress={() => void exportPacket()}
        />
      )}

      <Card style={{ backgroundColor: C.lavender }}>
        <Icon name="shield-checkmark-outline" />
        <Text style={S.h3}>Portable copies need extra care.</Text>
        <Txt>
          A saved or shared PDF can remain outside EnVizion after access is
          revoked. Include only what the receiving person needs, use secure
          sharing methods, and avoid sending care information to unintended
          recipients.
        </Txt>
      </Card>

      <Section title="Recent packet workflows" action="Refresh" onPress={() => void refresh()} />
      {history.length ? (
        history.map((item) => (
          <Card key={item.id}>
            <View style={S.between}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={S.h3}>{carePacketTitle(item.packetType)}</Text>
                <Txt style={S.small}>
                  {new Date(item.startedAt).toLocaleString()} ·{" "}
                  {item.includedSections.length} section
                  {item.includedSections.length === 1 ? "" : "s"}
                </Txt>
              </View>
              <View style={S.pill}>
                <Text style={S.small}>{statusLabel(item.status)}</Text>
              </View>
            </View>
          </Card>
        ))
      ) : (
        <Card>
          <Txt>No packet export workflows recorded yet.</Txt>
        </Card>
      )}

      <Txt style={S.small}>
        Care packets summarize caregiver-entered EnVizion information for a
        conversation. They are not a complete clinical record, diagnosis,
        emergency service, or individualized care plan.
      </Txt>
    </Page>
  );
}
