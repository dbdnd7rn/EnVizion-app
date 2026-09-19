import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStack } from "../navigation";
import {
  approveClinicalContent,
  loadClinicalContentItem,
  loadClinicalContentVersions,
  loadManagedClinicalContent,
  publishClinicalContent,
  returnClinicalContentToDraft,
  saveClinicalContent,
  submitClinicalContentForReview,
  type ClinicalContentRecord,
  type ClinicalContentVersion,
  type ClinicalSection,
  type ClinicalStatus,
} from "../clinicalContent";
import type { StaffRole } from "../staff";
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
import { useNav } from "./MainScreens";

function statusLabel(status: ClinicalStatus) {
  return {
    draft: "Draft",
    clinical_review: "Clinical review",
    approved: "Approved",
    published: "Published",
  }[status];
}

function StatusPill({ status }: { status: ClinicalStatus }) {
  const published = status === "published";
  const approved = status === "approved";
  return (
    <View
      style={[
        S.pill,
        {
          backgroundColor: published || approved ? "#E8F1ED" : C.lavender,
          alignSelf: "flex-start",
        },
      ]}
    >
      <Text
        style={[
          S.small,
          {
            fontFamily: "DMSans_600SemiBold",
            color: published || approved ? C.green : C.deep,
          },
        ]}
      >
        {statusLabel(status)}
      </Text>
    </View>
  );
}

export function StaffClinicalContentScreen() {
  const n = useNav();
  const [items, setItems] = useState<ClinicalContentRecord[]>([]);
  const [role, setRole] = useState<StaffRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const result = await loadManagedClinicalContent();
      setRole(result.role);
      setItems(result.items);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not load clinical content.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const counts = {
    draft: items.filter((item) => item.status === "draft").length,
    review: items.filter((item) => item.status === "clinical_review").length,
    approved: items.filter((item) => item.status === "approved").length,
    published: items.filter((item) => item.status === "published").length,
  };

  return (
    <Page>
      <Heading
        eyebrow="CLINICAL CONTENT GOVERNANCE"
        title="Review what caregivers can see"
        body="Edit educational content, move it through clinical review, and publish only approved guidance."
      />

      <Card style={{ backgroundColor: C.deep, borderWidth: 0 }}>
        <Text style={[S.eyebrow, { color: "#E5C8ED" }]}>
          {role ? role.toUpperCase() : "STAFF"} ACCESS
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
          {[
            ["Draft", counts.draft],
            ["In review", counts.review],
            ["Approved", counts.approved],
            ["Published", counts.published],
          ].map(([label, value]) => (
            <View key={String(label)} style={{ minWidth: "42%" }}>
              <Text style={[S.title, { color: C.white, fontSize: 26 }]}>
                {value}
              </Text>
              <Txt style={{ color: "#E9DDED" }}>{label}</Txt>
            </View>
          ))}
        </View>
      </Card>

      <Section title="Content library" action="Refresh" onPress={() => void refresh()} />

      {Boolean(message) && (
        <Card style={{ backgroundColor: C.redBg }}>
          <Text accessibilityRole="alert" style={[S.body, { color: C.rose }]}>
            {message}
          </Text>
        </Card>
      )}

      {loading ? (
        <Card>
          <ActivityIndicator color={C.purple} />
          <Txt>Loading governed content…</Txt>
        </Card>
      ) : (
        items.map((item) => (
          <Card
            key={item.uuid}
            onPress={() =>
              n.navigate("ClinicalContentEditor", { contentId: item.uuid })
            }
            label={`Open ${item.title}`}
          >
            <View style={S.between}>
              <Text style={S.eyebrow}>{item.category}</Text>
              <StatusPill status={item.status} />
            </View>
            <Text style={S.h3}>{item.title}</Text>
            <Txt>{item.description}</Txt>
            <View style={S.between}>
              <Text style={S.small}>Version {item.version}</Text>
              <Text style={S.small}>
                Updated {new Date(item.updatedAt).toLocaleDateString()}
              </Text>
            </View>
          </Card>
        ))
      )}

      {!loading && !items.length && (
        <Card>
          <Icon name="document-text-outline" />
          <Text style={S.h3}>No governed content yet.</Text>
          <Txt>Clinical education records will appear here.</Txt>
        </Card>
      )}

      <Txt style={S.small}>
        Advocates can edit drafts and submit them for review. Only Admins can
        approve and publish content.
      </Txt>
    </Page>
  );
}

export function ClinicalContentEditorScreen({
  route,
}: NativeStackScreenProps<RootStack, "ClinicalContentEditor">) {
  const [item, setItem] = useState<ClinicalContentRecord | null>(null);
  const [versions, setVersions] = useState<ClinicalContentVersion[]>([]);
  const [role, setRole] = useState<StaffRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const [managed, current, history] = await Promise.all([
        loadManagedClinicalContent(),
        loadClinicalContentItem(route.params.contentId),
        loadClinicalContentVersions(route.params.contentId),
      ]);
      setRole(managed.role);
      setItem(current);
      setVersions(history);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not load this content.",
      );
    } finally {
      setLoading(false);
    }
  }, [route.params.contentId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading) {
    return (
      <Page>
        <ActivityIndicator color={C.purple} />
        <Txt>Loading content record…</Txt>
      </Page>
    );
  }

  if (!item) {
    return (
      <Page>
        <Heading title="Content unavailable" />
        {Boolean(message) && <Txt>{message}</Txt>}
        <Button title="Try again" onPress={() => void refresh()} />
      </Page>
    );
  }

  const editable = item.status !== "published";

  function setField<K extends keyof ClinicalContentRecord>(
    key: K,
    value: ClinicalContentRecord[K],
  ) {
    setItem((current) => (current ? { ...current, [key]: value } : current));
  }

  function updateSection(index: number, patch: Partial<ClinicalSection>) {
    setItem((current) => {
      if (!current) return current;
      return {
        ...current,
        sections: current.sections.map((section, i) =>
          i === index ? { ...section, ...patch } : section,
        ),
      };
    });
  }

  async function run(action: () => Promise<ClinicalContentRecord>, success: string) {
    setBusy(true);
    setMessage("");
    try {
      const updated = await action();
      setItem(updated);
      setMessage(success);
      setVersions(await loadClinicalContentVersions(updated.uuid));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The content update failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page>
      <View style={S.between}>
        <StatusPill status={item.status} />
        <Text style={S.small}>Version {item.version}</Text>
      </View>

      <Heading
        eyebrow={item.category}
        title={item.title}
        body="Clinical content changes are versioned so previous states remain traceable."
      />

      <Card>
        <Field
          label="Title"
          value={item.title}
          onChange={(value) => setField("title", value)}
        />
        <Field
          label="Category"
          value={item.category}
          onChange={(value) => setField("category", value)}
        />
        <Field
          label="Short description"
          value={item.description}
          onChange={(value) => setField("description", value)}
          multiline
        />
        <Field
          label="Read time"
          value={item.readTime}
          onChange={(value) => setField("readTime", value)}
        />
        <Field
          label="Trusted source URL"
          value={item.url ?? ""}
          onChange={(value) => setField("url", value)}
        />
        <Field
          label="Clinical review notes"
          value={item.reviewNotes}
          onChange={(value) => setField("reviewNotes", value)}
          multiline
        />
      </Card>

      <Section title="Guide sections" />
      {item.sections.map((section, index) => (
        <Card key={`${index}-${section.title}`}>
          <Text style={S.eyebrow}>SECTION {index + 1}</Text>
          <Field
            label="Heading"
            value={section.title}
            onChange={(value) => updateSection(index, { title: value })}
          />
          <Field
            label="Body"
            value={section.body}
            onChange={(value) => updateSection(index, { body: value })}
            multiline
          />
          {editable && item.sections.length > 1 && (
            <Button
              title="Remove section"
              secondary
              disabled={busy}
              onPress={() =>
                setField(
                  "sections",
                  item.sections.filter((_, i) => i !== index),
                )
              }
            />
          )}
        </Card>
      ))}

      {editable && (
        <Button
          title="Add section"
          secondary
          icon="add-outline"
          disabled={busy}
          onPress={() =>
            setField("sections", [
              ...item.sections,
              { title: "", body: "" },
            ])
          }
        />
      )}

      {editable && (
        <Button
          title={busy ? "Saving…" : "Save changes"}
          disabled={busy}
          icon="save-outline"
          onPress={() =>
            void run(
              () => saveClinicalContent(item),
              "A new content version was saved.",
            )
          }
        />
      )}

      {item.status === "draft" && (
        <Button
          title="Submit for clinical review"
          disabled={busy}
          onPress={() =>
            void run(
              () => submitClinicalContentForReview(item.uuid),
              "Content submitted for clinical review.",
            )
          }
        />
      )}

      {item.status === "clinical_review" && role === "admin" && (
        <Button
          title="Approve clinical content"
          disabled={busy}
          icon="shield-checkmark-outline"
          onPress={() =>
            void run(
              () => approveClinicalContent(item.uuid, item.reviewNotes),
              "Clinical content approved.",
            )
          }
        />
      )}

      {item.status === "approved" && role === "admin" && (
        <Button
          title="Publish to caregiver library"
          disabled={busy}
          icon="cloud-upload-outline"
          onPress={() =>
            void run(
              () => publishClinicalContent(item.uuid),
              "Content published to caregivers.",
            )
          }
        />
      )}

      {item.status !== "draft" && (
        <Button
          title="Return to draft"
          secondary
          disabled={busy}
          onPress={() =>
            void run(
              () => returnClinicalContentToDraft(item.uuid),
              "Content returned to draft.",
            )
          }
        />
      )}

      {Boolean(message) && (
        <Card
          style={{
            backgroundColor: message.toLowerCase().includes("failed")
              ? C.redBg
              : C.white,
          }}
        >
          <Text accessibilityRole="alert" style={S.body}>
            {message}
          </Text>
        </Card>
      )}

      <Section title="Version history" />
      {versions.map((version) => (
        <Card key={version.id}>
          <View style={S.between}>
            <Text style={S.h3}>Version {version.version}</Text>
            <Text style={S.small}>
              {new Date(version.createdAt).toLocaleString()}
            </Text>
          </View>
          <Text style={S.eyebrow}>
            {version.action.replaceAll("_", " ")}
          </Text>
          {version.snapshot.status && (
            <Txt>Status: {statusLabel(version.snapshot.status)}</Txt>
          )}
        </Card>
      ))}

      <Txt style={S.small}>
        Publishing makes this version visible in the caregiver resource library.
        Returning a published item to draft removes it from the published feed.
      </Txt>
    </Page>
  );
}
