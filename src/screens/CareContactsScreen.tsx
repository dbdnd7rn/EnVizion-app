import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  careContactCategories,
  careContactCategoryLabels,
  careContactSearchText,
  createCareContact,
  deleteCareContact,
  loadCareContacts,
  preferredContactMethodLabels,
  preferredContactMethods,
  updateCareContact,
  type CareContact,
  type CareContactCategory,
  type CareContactInput,
  type PreferredContactMethod,
} from "../careContacts";
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

function blankContact(): CareContactInput {
  return {
    category: "primary_care",
    providerName: "",
    organizationName: "",
    specialty: "",
    phone: "",
    email: "",
    address: "",
    preferredContactMethod: "phone",
    officeHours: "",
    notes: "",
  };
}

function Picker<T extends string>({
  values,
  value,
  labels,
  disabled,
  onChange,
}: {
  values: readonly T[];
  value: T;
  labels: Record<T, string>;
  disabled?: boolean;
  onChange: (next: T) => void;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {values.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(option)}
            style={[
              S.pill,
              {
                minHeight: 42,
                justifyContent: "center",
                paddingHorizontal: 14,
                backgroundColor: selected ? C.purple : C.lavender,
                opacity: disabled ? 0.55 : 1,
              },
            ]}
          >
            <Text
              style={[
                S.h3,
                {
                  fontSize: 12,
                  color: selected ? C.white : C.deep,
                },
              ]}
            >
              {labels[option]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SmallAction({
  title,
  icon,
  onPress,
}: {
  title: string;
  icon: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 42,
          borderRadius: 13,
          paddingHorizontal: 14,
          paddingVertical: 10,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 7,
          backgroundColor: C.lavender,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      <Icon name={icon} size={17} />
      <Text style={[S.h3, { fontSize: 12, color: C.deep }]}>{title}</Text>
    </Pressable>
  );
}

export function CareContactsScreen() {
  const { state } = useCare();
  const careRecipientId = state.careRecipientId;
  const viewer = state.accessRole === "viewer";
  const [contacts, setContacts] = useState<CareContact[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | CareContactCategory>("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CareContactInput>(blankContact());

  const refresh = useCallback(async () => {
    if (!careRecipientId) {
      setContacts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      setContacts(await loadCareContacts(careRecipientId));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not load this provider directory.",
      );
    } finally {
      setLoading(false);
    }
  }, [careRecipientId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return contacts.filter(
      (contact) =>
        (category === "all" || contact.category === category) &&
        (!needle || careContactSearchText(contact).includes(needle)),
    );
  }, [contacts, query, category]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<CareContactCategory, number>();
    careContactCategories.forEach((item) => counts.set(item, 0));
    contacts.forEach((contact) =>
      counts.set(contact.category, (counts.get(contact.category) ?? 0) + 1),
    );
    return counts;
  }, [contacts]);

  function openAdd() {
    setEditingId(null);
    setPendingDeleteId(null);
    setDraft(blankContact());
    setFormOpen(true);
    setMessage("");
  }

  function openEdit(contact: CareContact) {
    setEditingId(contact.id);
    setPendingDeleteId(null);
    setDraft({
      category: contact.category,
      providerName: contact.providerName,
      organizationName: contact.organizationName,
      specialty: contact.specialty,
      phone: contact.phone,
      email: contact.email,
      address: contact.address,
      preferredContactMethod: contact.preferredContactMethod,
      officeHours: contact.officeHours,
      notes: contact.notes,
    });
    setFormOpen(true);
    setMessage("");
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setPendingDeleteId(null);
    setDraft(blankContact());
  }

  async function save() {
    if (!careRecipientId || viewer || busy) return;

    if (!draft.providerName.trim()) {
      setMessage("Add the provider, organization, or department name first.");
      return;
    }

    if (
      draft.email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())
    ) {
      setMessage("Check the email address before saving.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      if (editingId) {
        await updateCareContact(careRecipientId, editingId, draft);
        setMessage("Care contact updated.");
      } else {
        await createCareContact(careRecipientId, draft);
        setMessage("Care contact added.");
      }
      closeForm();
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not save this care contact.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(contactId: string) {
    if (!careRecipientId || viewer || busy) return;

    setBusy(true);
    setMessage("");
    try {
      await deleteCareContact(careRecipientId, contactId);
      closeForm();
      await refresh();
      setMessage("Care contact removed.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not remove this care contact.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function call(phone: string) {
    try {
      const number = phone.replace(/[^+\d*#,;]/g, "");
      await Linking.openURL(`tel:${number}`);
    } catch {
      setMessage("This device could not open the phone app for that number.");
    }
  }

  async function email(address: string) {
    try {
      await Linking.openURL(`mailto:${address.trim()}`);
    } catch {
      setMessage("This device could not open an email app for that address.");
    }
  }

  if (!careRecipientId) {
    return (
      <Page>
        <Heading
          eyebrow="CARE CONTACTS"
          title="Choose a care profile first."
          body="Provider contacts live inside a specific care profile."
        />
      </Page>
    );
  }

  return (
    <Page>
      <Heading
        eyebrow="CARE CONTACTS + PROVIDER DIRECTORY"
        title="The right number, person, and place — close at hand."
        body="Keep doctors, specialists, pharmacies, home health, insurance, and hospital departments together for this care profile."
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
          access · {contacts.length} saved {contacts.length === 1 ? "contact" : "contacts"}
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
          <Text style={S.h3}>Viewer access is read-only.</Text>
          <Txt>
            You can use the shared provider directory, but only the Owner or a
            Caregiver can change contact details.
          </Txt>
        </Card>
      )}

      {!viewer && !formOpen && (
        <Button
          title="Add care contact"
          icon="person-add-outline"
          onPress={openAdd}
        />
      )}

      {formOpen && !viewer && (
        <>
          <Section title={editingId ? "Edit care contact" : "Add care contact"} />
          <Card>
            <Text style={S.h3}>Type of contact</Text>
            <Picker
              values={careContactCategories}
              value={draft.category}
              labels={careContactCategoryLabels}
              disabled={busy}
              onChange={(next) =>
                setDraft((current) => ({ ...current, category: next }))
              }
            />

            <Field
              label="Provider, organization, or department name"
              value={draft.providerName}
              onChange={(providerName) =>
                setDraft((current) => ({ ...current, providerName }))
              }
            />
            <Field
              label="Organization or facility"
              value={draft.organizationName}
              onChange={(organizationName) =>
                setDraft((current) => ({ ...current, organizationName }))
              }
            />
            <Field
              label="Role or specialty"
              value={draft.specialty}
              onChange={(specialty) =>
                setDraft((current) => ({ ...current, specialty }))
              }
            />
            <Field
              label="Phone"
              value={draft.phone}
              onChange={(phone) =>
                setDraft((current) => ({ ...current, phone }))
              }
            />
            <Field
              label="Email"
              value={draft.email}
              onChange={(email) =>
                setDraft((current) => ({ ...current, email }))
              }
            />
            <Field
              label="Address"
              value={draft.address}
              onChange={(address) =>
                setDraft((current) => ({ ...current, address }))
              }
              multiline
            />

            <Text style={S.h3}>Preferred contact method</Text>
            <Picker
              values={preferredContactMethods}
              value={draft.preferredContactMethod}
              labels={preferredContactMethodLabels}
              disabled={busy}
              onChange={(preferredContactMethod) =>
                setDraft((current) => ({
                  ...current,
                  preferredContactMethod,
                }))
              }
            />

            <Field
              label="Office hours"
              value={draft.officeHours}
              onChange={(officeHours) =>
                setDraft((current) => ({ ...current, officeHours }))
              }
            />
            <Field
              label="Caregiver notes"
              value={draft.notes}
              onChange={(notes) =>
                setDraft((current) => ({ ...current, notes }))
              }
              multiline
            />

            <Button
              title={editingId ? "Save changes" : "Add contact"}
              disabled={busy}
              icon="checkmark-circle-outline"
              onPress={() => void save()}
            />
            <Button
              title="Cancel"
              secondary
              disabled={busy}
              onPress={closeForm}
            />

            {editingId && (
              <>
                <Button
                  title={
                    pendingDeleteId === editingId
                      ? "Cancel delete"
                      : "Delete this contact"
                  }
                  secondary
                  disabled={busy}
                  onPress={() =>
                    setPendingDeleteId((current) =>
                      current === editingId ? null : editingId,
                    )
                  }
                />
                {pendingDeleteId === editingId && (
                  <Card style={{ backgroundColor: C.redBg }}>
                    <Text style={[S.h3, { color: C.rose }]}>
                      Remove this contact from the shared care profile?
                    </Text>
                    <Txt>
                      This does not contact the provider. It only removes this
                      saved directory entry.
                    </Txt>
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => void remove(editingId)}
                      style={({ pressed }) => ({
                        minHeight: 48,
                        borderRadius: 14,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: C.rose,
                        opacity: busy ? 0.5 : pressed ? 0.75 : 1,
                      })}
                    >
                      <Text style={[S.h3, { fontSize: 13, color: C.white }]}>
                        Delete permanently
                      </Text>
                    </Pressable>
                  </Card>
                )}
              </>
            )}
          </Card>
        </>
      )}

      <Section
        title="Provider directory"
        action="Refresh"
        onPress={() => void refresh()}
      />

      <View style={[S.input, S.row]}>
        <Icon name="search-outline" size={20} />
        <TextInput
          accessibilityLabel="Search care contacts"
          placeholder="Search name, specialty, pharmacy, phone…"
          placeholderTextColor="#AAA0AF"
          value={query}
          onChangeText={setQuery}
          style={{
            flex: 1,
            fontFamily: "DMSans_400Regular",
            fontSize: 14,
            color: C.ink,
          }}
        />
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ selected: category === "all" }}
          onPress={() => setCategory("all")}
          style={[
            S.pill,
            {
              minHeight: 40,
              justifyContent: "center",
              backgroundColor: category === "all" ? C.purple : C.lavender,
            },
          ]}
        >
          <Text
            style={[
              S.h3,
              {
                fontSize: 11,
                color: category === "all" ? C.white : C.deep,
              },
            ]}
          >
            All · {contacts.length}
          </Text>
        </Pressable>

        {careContactCategories.map((item) => (
          <Pressable
            key={item}
            accessibilityRole="radio"
            accessibilityState={{ selected: category === item }}
            onPress={() => setCategory(item)}
            style={[
              S.pill,
              {
                minHeight: 40,
                justifyContent: "center",
                backgroundColor: category === item ? C.purple : C.lavender,
              },
            ]}
          >
            <Text
              style={[
                S.h3,
                {
                  fontSize: 11,
                  color: category === item ? C.white : C.deep,
                },
              ]}
            >
              {careContactCategoryLabels[item]} · {categoryCounts.get(item) ?? 0}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <Card>
          <ActivityIndicator color={C.purple} />
          <Txt>Loading provider directory…</Txt>
        </Card>
      ) : filtered.length ? (
        filtered.map((contact) => (
          <Card key={contact.id}>
            <View style={S.between}>
              <View style={{ flex: 1, gap: 4 }}>
                <View
                  style={[
                    S.pill,
                    {
                      alignSelf: "flex-start",
                      backgroundColor: C.lavender,
                    },
                  ]}
                >
                  <Text style={[S.small, { color: C.deep }]}>
                    {careContactCategoryLabels[contact.category]}
                  </Text>
                </View>
                <Text style={S.h2}>{contact.providerName}</Text>
                {Boolean(contact.organizationName) && (
                  <Txt>{contact.organizationName}</Txt>
                )}
                {Boolean(contact.specialty) && (
                  <Text style={[S.small, { color: C.purple }]}>
                    {contact.specialty}
                  </Text>
                )}
              </View>

              {!viewer && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${contact.providerName}`}
                  onPress={() => openEdit(contact)}
                  style={{
                    minWidth: 44,
                    minHeight: 44,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="create-outline" />
                </Pressable>
              )}
            </View>

            <View style={S.divider} />

            {Boolean(contact.phone) && (
              <View style={S.row}>
                <Icon name="call-outline" size={18} />
                <Txt style={{ flex: 1 }}>{contact.phone}</Txt>
              </View>
            )}
            {Boolean(contact.email) && (
              <View style={S.row}>
                <Icon name="mail-outline" size={18} />
                <Txt style={{ flex: 1 }}>{contact.email}</Txt>
              </View>
            )}
            {Boolean(contact.address) && (
              <View style={S.row}>
                <Icon name="location-outline" size={18} />
                <Txt style={{ flex: 1 }}>{contact.address}</Txt>
              </View>
            )}
            {Boolean(contact.officeHours) && (
              <View style={S.row}>
                <Icon name="time-outline" size={18} />
                <Txt style={{ flex: 1 }}>{contact.officeHours}</Txt>
              </View>
            )}

            <Text style={S.small}>
              Preferred contact:{" "}
              {preferredContactMethodLabels[contact.preferredContactMethod]}
            </Text>

            {Boolean(contact.notes) && (
              <Card style={{ backgroundColor: "#F8F4F9", padding: 14 }}>
                <Text style={S.eyebrow}>CAREGIVER NOTES</Text>
                <Txt>{contact.notes}</Txt>
              </Card>
            )}

            {(contact.phone || contact.email) && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {Boolean(contact.phone) && (
                  <SmallAction
                    title="Call"
                    icon="call-outline"
                    onPress={() => void call(contact.phone)}
                  />
                )}
                {Boolean(contact.email) && (
                  <SmallAction
                    title="Email"
                    icon="mail-outline"
                    onPress={() => void email(contact.email)}
                  />
                )}
              </View>
            )}
          </Card>
        ))
      ) : (
        <Card>
          <Icon name="people-circle-outline" size={30} />
          <Text style={S.h3}>
            {contacts.length
              ? "No contacts match this search."
              : "No care contacts saved yet."}
          </Text>
          <Txt>
            {contacts.length
              ? "Try another name, specialty, or category."
              : viewer
                ? "The Owner or a Caregiver can add providers to this shared care profile."
                : "Add the people and organizations you may need during appointments, transitions, and handoffs."}
          </Txt>
          {!viewer && !contacts.length && (
            <Button title="Add first contact" onPress={openAdd} />
          )}
        </Card>
      )}

      <Card style={{ backgroundColor: C.lavender }}>
        <Text style={S.h3}>Privacy stays profile-specific.</Text>
        <Txt>
          These contacts are shared only with people who already have access to
          this care profile. Provider details are never automatically added to a
          handoff or visit packet — you choose the specific contacts each time.
        </Txt>
      </Card>
    </Page>
  );
}
