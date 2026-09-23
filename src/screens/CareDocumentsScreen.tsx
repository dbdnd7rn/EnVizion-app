import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import {
  deleteCareDocument,
  loadCareDocuments,
  openCareDocument,
  pickCareDocument,
  setCareDocumentArchived,
  shareCareDocument,
  updateCareDocumentMetadata,
  uploadCareDocument,
  type CareDocument,
  type PickedCareDocument,
} from "../documents";
import {
  documentCategories,
  documentCategoryLabels,
  documentIconName,
  documentReviewLabel,
  documentReviewState,
  formatDocumentBytes,
  type DocumentCategory,
} from "../documentHelpers";
import { useAuth } from "../auth";
import { useCare } from "../store";
import { supabase } from "../supabase";
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

function CategoryChoices({
  value,
  disabled,
  onChange,
}: {
  value: DocumentCategory;
  disabled?: boolean;
  onChange: (value: DocumentCategory) => void;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {documentCategories.map((category) => (
        <Pressable
          key={category}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === category, disabled }}
          disabled={disabled}
          onPress={() => onChange(category)}
          style={[
            S.pill,
            {
              minHeight: 42,
              justifyContent: "center",
              paddingHorizontal: 12,
              opacity: disabled ? 0.6 : 1,
              backgroundColor: value === category ? C.purple : C.lavender,
            },
          ]}
        >
          <Text
            style={[
              S.h3,
              {
                fontSize: 11,
                color: value === category ? C.white : C.deep,
              },
            ]}
          >
            {documentCategoryLabels[category]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function CareDocumentsScreen() {
  const { user } = useAuth();
  const { state } = useCare();
  const [documents, setDocuments] = useState<CareDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");

  const [picked, setPicked] = useState<PickedCareDocument | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadCategory, setUploadCategory] =
    useState<DocumentCategory>("other");
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploadSource, setUploadSource] = useState("");
  const [uploadDocumentDate, setUploadDocumentDate] = useState("");
  const [uploadReviewDueOn, setUploadReviewDueOn] = useState("");
  const [uploadKey, setUploadKey] = useState(false);

  const [editing, setEditing] = useState<CareDocument | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] =
    useState<DocumentCategory>("other");
  const [editNotes, setEditNotes] = useState("");
  const [editSource, setEditSource] = useState("");
  const [editDocumentDate, setEditDocumentDate] = useState("");
  const [editReviewDueOn, setEditReviewDueOn] = useState("");
  const [editKey, setEditKey] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const [deleting, setDeleting] = useState<CareDocument | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const careRecipientId = state.careRecipientId;
  const readOnly = state.accessRole === "viewer";

  const refresh = useCallback(async () => {
    if (!careRecipientId) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      setDocuments(
        await loadCareDocuments(careRecipientId, {
          includeArchived: !readOnly,
        }),
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not load care documents.",
      );
    } finally {
      setLoading(false);
    }
  }, [careRecipientId, readOnly]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!careRecipientId) return;

    const channel = supabase
      .channel(`care-documents:${careRecipientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "care_documents",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [careRecipientId, refresh]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const visible = documents.filter(
      (document) => showArchived || !document.archivedAt,
    );
    if (!needle) return visible;

    return visible.filter((document) =>
      [
        document.displayName,
        document.originalName,
        documentCategoryLabels[document.category],
        document.notes,
        document.sourceName,
        document.documentDate,
        document.reviewDueOn,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [documents, query, showArchived]);

  function canManage(document: CareDocument) {
    return (
      state.accessRole === "owner" ||
      (state.accessRole === "caregiver" &&
        document.uploadedBy === user?.id)
    );
  }

  async function chooseFile() {
    setMessage("");
    try {
      const result = await pickCareDocument();
      if (!result) return;

      if (!result.sizeBytes) {
        setMessage("We could not read that file’s size.");
        return;
      }

      if (result.sizeBytes > 20 * 1024 * 1024) {
        setMessage("Care Vault files must be 20 MB or smaller.");
        return;
      }

      setPicked(result);
      setUploadName(result.name.replace(/.[^.]+$/, ""));
      setUploadCategory("other");
      setUploadSource("");
      setUploadDocumentDate("");
      setUploadReviewDueOn("");
      setUploadKey(false);
      setUploadNotes("");
      setUploadSource("");
      setUploadDocumentDate("");
      setUploadReviewDueOn("");
      setUploadKey(false);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not open the document picker.",
      );
    }
  }

  async function upload() {
    if (!careRecipientId || !picked || readOnly) return;

    setBusy("upload");
    setMessage("");
    try {
      await uploadCareDocument({
        careRecipientId,
        picked,
        displayName: uploadName,
        category: uploadCategory,
        notes: uploadNotes,
        sourceName: uploadSource,
        documentDate: uploadDocumentDate,
        reviewDueOn: uploadReviewDueOn,
        isKeyDocument: uploadKey,
      });

      setPicked(null);
      setUploadName("");
      setUploadNotes("");
      setUploadCategory("other");
      setMessage("Document securely added to the shared care vault.");
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not upload this care document.",
      );
    } finally {
      setBusy(null);
    }
  }

  function beginEdit(document: CareDocument) {
    setEditing(document);
    setEditName(document.displayName);
    setEditCategory(document.category);
    setEditNotes(document.notes);
    setEditSource(document.sourceName);
    setEditDocumentDate(document.documentDate);
    setEditReviewDueOn(document.reviewDueOn);
    setEditKey(document.isKeyDocument);
    setMessage("");
  }

  async function saveEdit() {
    if (!editing) return;

    setBusy(`edit-${editing.id}`);
    setMessage("");
    try {
      await updateCareDocumentMetadata({
        documentId: editing.id,
        displayName: editName,
        category: editCategory,
        notes: editNotes,
        sourceName: editSource,
        documentDate: editDocumentDate,
        reviewDueOn: editReviewDueOn,
        isKeyDocument: editKey,
      });
      setEditing(null);
      setMessage("Document details updated.");
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not update document details.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function openDocument(
    document: CareDocument,
    mode: "preview" | "download",
  ) {
    setBusy(`${mode}-${document.id}`);
    setMessage("");
    try {
      await openCareDocument(document.id, mode);
      setMessage(
        mode === "download"
          ? "Secure download link opened. It expires shortly."
          : "Secure preview opened. The link expires shortly.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not open this care document.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function shareDocument(document: CareDocument) {
    setBusy(`share-${document.id}`);
    setMessage("");
    try {
      const result = await shareCareDocument(document.id);
      setMessage(
        `Secure share link created for ${document.displayName}. It expires in ${Math.round(
          result.expiresIn / 60,
        )} minutes.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not create a secure share link.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function setArchived(document: CareDocument, archived: boolean) {
    setBusy(`${archived ? "archive" : "restore"}-${document.id}`);
    setMessage("");
    try {
      await setCareDocumentArchived(document.id, archived);
      await refresh();
      setMessage(
        archived
          ? `${document.displayName} moved to archived documents.`
          : `${document.displayName} restored to the active vault.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not update the document archive state.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function confirmDelete() {
    if (!deleting || deleteConfirmation !== deleting.displayName) return;

    setBusy(`delete-${deleting.id}`);
    setMessage("");
    try {
      await deleteCareDocument(deleting.id);
      setDeleting(null);
      setDeleteConfirmation("");
      setMessage("Document permanently deleted from the care vault.");
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not delete this document.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <Page>
      <Heading
        eyebrow="CARE DOCUMENT VAULT"
        title="Keep important papers with the care story."
        body="Private documents for the active care profile, protected by the same shared-care permissions as the rest of EnVizion Life."
      />

      <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
        <Card style={{ flex: 1, minWidth: 115 }}>
          <Text style={S.eyebrow}>KEY DOCS</Text>
          <Text style={S.h2}>
            {documents.filter((document) => document.isKeyDocument && !document.archivedAt).length}
          </Text>
          <Txt style={S.small}>quick-reference records</Txt>
        </Card>
        <Card style={{ flex: 1, minWidth: 115 }}>
          <Text style={S.eyebrow}>REVIEW</Text>
          <Text style={S.h2}>
            {
              documents.filter((document) => {
                const state = documentReviewState(document.reviewDueOn);
                return !document.archivedAt && (state === "overdue" || state === "due_soon");
              }).length
            }
          </Text>
          <Txt style={S.small}>due / overdue</Txt>
        </Card>
        {!readOnly && (
          <Card style={{ flex: 1, minWidth: 115 }}>
            <Text style={S.eyebrow}>ARCHIVED</Text>
            <Text style={S.h2}>
              {documents.filter((document) => document.archivedAt).length}
            </Text>
            <Txt style={S.small}>kept out of active view</Txt>
          </Card>
        )}
      </View>

      <Card style={{ backgroundColor: C.deep, borderWidth: 0 }}>
        <Text style={[S.eyebrow, { color: "#E5C8ED" }]}>ACTIVE CARE PROFILE</Text>
        <Text style={[S.h2, { color: C.white }]}>
          {state.careRecipientName || "Care profile"}
        </Text>
        <Txt style={{ color: "#E9DDED" }}>
          {state.accessRole === "owner"
            ? "Owner · manage all documents"
            : state.accessRole === "caregiver"
              ? "Caregiver · manage documents you upload"
              : "Viewer · read-only document access"}
        </Txt>
      </Card>

      {Boolean(message) && (
        <Card>
          <Text accessibilityRole="alert" style={S.body}>
            {message}
          </Text>
        </Card>
      )}

      {!readOnly && (
        <>
          <Section title="Add a document" />
          {!picked ? (
            <Card>
              <Icon name="cloud-upload-outline" size={30} />
              <Text style={S.h3}>Choose a file from this device.</Text>
              <Txt>
                PDF, images, Word documents, or plain text. Maximum size 20 MB.
              </Txt>
              <Button
                title="Choose document"
                icon="folder-open-outline"
                disabled={busy !== null}
                onPress={() => void chooseFile()}
              />
            </Card>
          ) : (
            <Card>
              <View style={{ flexDirection: "row", gap: 13 }}>
                <View
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 14,
                    backgroundColor: C.lavender,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name={documentIconName(picked.mimeType)} size={22} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={S.h3}>{picked.name}</Text>
                  <Txt style={S.small}>
                    {formatDocumentBytes(picked.sizeBytes)} · {picked.mimeType}
                  </Txt>
                </View>
              </View>

              <Field
                label="Display name"
                value={uploadName}
                onChange={setUploadName}
              />

              <Text style={S.h3}>Category</Text>
              <CategoryChoices
                value={uploadCategory}
                disabled={busy !== null}
                onChange={setUploadCategory}
              />

              <Field
                label="Source / provider (optional)"
                value={uploadSource}
                onChange={setUploadSource}
              />
              <Field
                label="Document date (YYYY-MM-DD, optional)"
                value={uploadDocumentDate}
                onChange={setUploadDocumentDate}
              />
              <Field
                label="Review due date (YYYY-MM-DD, optional)"
                value={uploadReviewDueOn}
                onChange={setUploadReviewDueOn}
              />
              <Field
                label="Notes (optional)"
                value={uploadNotes}
                onChange={setUploadNotes}
                multiline
              />
              <Button
                title={
                  uploadKey
                    ? "Key document · remove key status"
                    : "Mark as key document"
                }
                secondary
                disabled={busy !== null}
                icon={uploadKey ? "star" : "star-outline"}
                onPress={() => setUploadKey((value) => !value)}
              />

              <Button
                title={
                  busy === "upload"
                    ? "Uploading securely…"
                    : "Upload to Care Vault"
                }
                icon="lock-closed-outline"
                disabled={busy !== null || !uploadName.trim()}
                onPress={() => void upload()}
              />
              <Button
                title="Choose a different file"
                secondary
                disabled={busy !== null}
                onPress={() => void chooseFile()}
              />
              <Button
                title="Cancel"
                secondary
                disabled={busy !== null}
                onPress={() => setPicked(null)}
              />
            </Card>
          )}
        </>
      )}

      {readOnly && (
        <Card style={{ backgroundColor: C.lavender }}>
          <Icon name="eye-outline" />
          <Text style={S.h3}>Viewer access is read-only.</Text>
          <Txt>
            You can securely preview and download documents, but cannot upload,
            rename, recategorize, or delete them.
          </Txt>
        </Card>
      )}

      {editing && (
        <>
          <Section title="Edit document details" />
          <Card>
            <Text style={S.h3}>{editing.originalName}</Text>
            <Field label="Display name" value={editName} onChange={setEditName} />
            <Text style={S.h3}>Category</Text>
            <CategoryChoices
              value={editCategory}
              disabled={busy !== null}
              onChange={setEditCategory}
            />
            <Field
              label="Source / provider (optional)"
              value={editSource}
              onChange={setEditSource}
            />
            <Field
              label="Document date (YYYY-MM-DD, optional)"
              value={editDocumentDate}
              onChange={setEditDocumentDate}
            />
            <Field
              label="Review due date (YYYY-MM-DD, optional)"
              value={editReviewDueOn}
              onChange={setEditReviewDueOn}
            />
            <Field
              label="Notes (optional)"
              value={editNotes}
              onChange={setEditNotes}
              multiline
            />
            <Button
              title={
                editKey
                  ? "Key document · remove key status"
                  : "Mark as key document"
              }
              secondary
              disabled={busy !== null}
              icon={editKey ? "star" : "star-outline"}
              onPress={() => setEditKey((value) => !value)}
            />
            <Button
              title="Save document details"
              disabled={busy !== null || !editName.trim()}
              onPress={() => void saveEdit()}
            />
            <Button
              title="Cancel editing"
              secondary
              disabled={busy !== null}
              onPress={() => setEditing(null)}
            />
          </Card>
        </>
      )}

      {deleting && (
        <>
          <Section title="Confirm permanent deletion" />
          <Card style={{ borderColor: "#E7C3C7" }}>
            <Text style={[S.h3, { color: C.rose }]}>
              Delete {deleting.displayName}?
            </Text>
            <Txt>
              This removes the file itself and its vault metadata. The deletion
              action remains in the care audit history.
            </Txt>
            <Txt style={S.small}>
              Type <Text style={S.h3}>{deleting.displayName}</Text> exactly to
              confirm.
            </Txt>
            <Field
              label="Document name"
              value={deleteConfirmation}
              onChange={setDeleteConfirmation}
            />
            <Button
              title="Delete document permanently"
              secondary
              disabled={
                busy !== null ||
                deleteConfirmation !== deleting.displayName
              }
              onPress={() => void confirmDelete()}
            />
            <Button
              title="Cancel"
              secondary
              disabled={busy !== null}
              onPress={() => {
                setDeleting(null);
                setDeleteConfirmation("");
              }}
            />
          </Card>
        </>
      )}

      <Section title="Documents" action="Refresh" onPress={() => void refresh()} />

      <Field
        label="Search documents"
        value={query}
        onChange={setQuery}
      />

      {!readOnly && documents.some((document) => document.archivedAt) && (
        <Button
          title={showArchived ? "Hide archived documents" : "Show archived documents"}
          secondary
          icon={showArchived ? "eye-off-outline" : "archive-outline"}
          onPress={() => setShowArchived((value) => !value)}
        />
      )}

      {loading && !documents.length ? (
        <Card>
          <ActivityIndicator color={C.purple} />
          <Txt>Loading private care documents…</Txt>
        </Card>
      ) : !filtered.length ? (
        <Card>
          <Icon name="folder-open-outline" size={30} />
          <Text style={S.h3}>
            {documents.length ? "No documents match your search." : "No documents yet."}
          </Text>
          <Txt>
            Important discharge papers, care plans, insurance files, and other
            documents can live here with the care profile.
          </Txt>
        </Card>
      ) : (
        filtered.map((document) => {
          const manageable = canManage(document);
          return (
            <Card key={document.id}>
              <View style={{ flexDirection: "row", gap: 13 }}>
                <View
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 14,
                    backgroundColor: C.lavender,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name={documentIconName(document.mimeType)} size={22} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={S.between}>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={S.h3}>{document.displayName}</Text>
                      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                        <View style={S.pill}>
                          <Text style={S.small}>
                            {documentCategoryLabels[document.category]}
                          </Text>
                        </View>
                        {document.isKeyDocument && (
                          <View style={[S.pill, { backgroundColor: "#FFF1E5" }]}>
                            <Text style={S.small}>Key document</Text>
                          </View>
                        )}
                        {document.archivedAt && (
                          <View style={[S.pill, { backgroundColor: "#EFECEF" }]}>
                            <Text style={S.small}>Archived</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                  <Txt style={S.small}>
                    {formatDocumentBytes(document.sizeBytes)} ·{" "}
                    {new Date(document.createdAt).toLocaleDateString()}
                    {document.documentDate ? " · Document " + document.documentDate : ""}
                  </Txt>
                  {Boolean(document.sourceName) && (
                    <Txt style={S.small}>Source: {document.sourceName}</Txt>
                  )}
                  {Boolean(document.reviewDueOn) && (
                    <Txt
                      style={[
                        S.small,
                        documentReviewState(document.reviewDueOn) === "overdue" ||
                        documentReviewState(document.reviewDueOn) === "due_soon"
                          ? { color: C.rose }
                          : null,
                      ]}
                    >
                      {documentReviewLabel(document.reviewDueOn)} · {document.reviewDueOn}
                    </Txt>
                  )}
                  {Boolean(document.notes) && <Txt>{document.notes}</Txt>}
                </View>
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <View style={{ flexGrow: 1, minWidth: 130 }}>
                  <Button
                    title="Preview"
                    secondary
                    icon="eye-outline"
                    disabled={busy !== null}
                    onPress={() => void openDocument(document, "preview")}
                  />
                </View>
                <View style={{ flexGrow: 1, minWidth: 130 }}>
                  <Button
                    title="Download"
                    secondary
                    icon="download-outline"
                    disabled={busy !== null}
                    onPress={() => void openDocument(document, "download")}
                  />
                </View>
              </View>

              {manageable && (
                <>
                  <Button
                    title="Share secure 10-minute link"
                    secondary
                    icon="share-outline"
                    disabled={busy !== null}
                    onPress={() => void shareDocument(document)}
                  />
                  <Button
                    title="Edit details"
                    secondary
                    icon="create-outline"
                    disabled={busy !== null}
                    onPress={() => beginEdit(document)}
                  />
                  <Button
                    title={document.archivedAt ? "Restore document" : "Archive document"}
                    secondary
                    icon={document.archivedAt ? "refresh-outline" : "archive-outline"}
                    disabled={busy !== null}
                    onPress={() => void setArchived(document, !document.archivedAt)}
                  />
                  <Button
                    title="Delete document permanently"
                    secondary
                    icon="trash-outline"
                    disabled={busy !== null}
                    onPress={() => {
                      setDeleting(document);
                      setDeleteConfirmation("");
                    }}
                  />
                </>
              )}
            </Card>
          );
        })
      )}

      <Card style={{ backgroundColor: C.lavender }}>
        <Icon name="shield-checkmark-outline" />
        <Text style={S.h3}>Private by design</Text>
        <Txt>
          Care Vault files are never public. EnVizion creates short-lived secure
          links only when an authorized care-team member previews or downloads
          a document, and that access is recorded in the care audit history.
        </Txt>
      </Card>
    </Page>
  );
}
