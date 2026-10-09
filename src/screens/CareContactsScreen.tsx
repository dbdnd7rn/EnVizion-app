import { themeBackground, themeShadow, themeAction } from "../themeColors";
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
  Fade,
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
                backgroundColor: selected ? themeAction(C.purple) : C.lavender,
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


const categoryVisuals: Record<
  CareContactCategory,
  { icon: string; background: string; color: string }
> = {
  primary_care: { icon: "medkit-outline", background: "#F2EAFB", color: "#74328F" },
  specialist: { icon: "person-outline", background: "#F2EAFB", color: "#74328F" },
  pharmacy: { icon: "medical-outline", background: "#E6F7EF", color: "#16885A" },
  home_health: { icon: "home-outline", background: "#FFF2D9", color: "#E27A00" },
  insurance: { icon: "shield-checkmark-outline", background: "#EAF2FF", color: "#2D71C7" },
  hospital_department: { icon: "business-outline", background: "#FFE7EF", color: "#D94C78" },
  other: { icon: "ellipsis-horizontal", background: "#F2EAFB", color: "#74328F" },
};

function DirectoryCategoryTile({
  label,
  count,
  icon,
  iconBackground,
  iconColor,
  selected,
  onPress,
}: {
  label: string;
  count: number;
  icon: string;
  iconBackground: string;
  iconColor: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label + ", " + count}
      onPress={onPress}
      style={({ pressed }) => ({
        width: "48.6%",
        minHeight: 78,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: selected ? "#DCC8E8" : "#EEE7F0",
        backgroundColor: selected ? "#F6EEFC" : C.white,
        paddingHorizontal: 12,
        paddingVertical: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        opacity: pressed ? 0.76 : 1,
        transform: [{ scale: pressed ? 0.985 : 1 }],
        shadowColor: "#3A2544",
        shadowOpacity: selected ? 0.05 : 0.025,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 5 },
        elevation: 1,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 14,
          backgroundColor: iconBackground,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={icon} color={iconColor} size={21} />
      </View>

      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Text
          numberOfLines={2}
          style={{
            fontFamily: "DMSans_600SemiBold",
            fontSize: 13,
            lineHeight: 17,
            color: C.ink,
          }}
        >
          {label}
        </Text>
        <Text style={[S.small, { fontSize: 12 }]}>{count}</Text>
      </View>

      <Icon name="chevron-forward" color="#7B5890" size={16} />
    </Pressable>
  );
}

function EmptyDirectoryArt() {
  return (
    <View
      pointerEvents="none"
      style={{
        width: 142,
        height: 118,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          position: "absolute",
          width: 112,
          height: 92,
          borderRadius: 46,
          backgroundColor: "#F2E9FA",
        }}
      />
      <View
        style={{
          position: "absolute",
          width: 72,
          height: 72,
          borderRadius: 36,
          right: 0,
          top: 17,
          backgroundColor: "#F7F0FC",
        }}
      />
      <View
        style={{
          width: 96,
          height: 60,
          borderRadius: 17,
          backgroundColor: themeBackground(C.white),
          borderWidth: 4,
          borderColor: "#E5D6F0",
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 12,
          gap: 10,
          transform: [{ rotate: "-4deg" }],
          shadowColor: "#4C2B61",
          shadowOpacity: 0.09,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 5 },
          elevation: 2,
        }}
      >
        <View
          style={{
            width: 27,
            height: 27,
            borderRadius: 14,
            backgroundColor: "#F2E9FA",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="person" size={16} />
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          <View style={{ height: 4, borderRadius: 2, backgroundColor: "#A768BE" }} />
          <View style={{ height: 4, width: "76%", borderRadius: 2, backgroundColor: "#D2BCE0" }} />
        </View>
      </View>

      <View
        style={{
          position: "absolute",
          left: 4,
          bottom: 6,
          width: 43,
          height: 43,
          borderRadius: 22,
          backgroundColor: "#7D36A1",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name="call" color={C.white} size={20} />
      </View>

      <View
        style={{
          position: "absolute",
          right: 3,
          bottom: 9,
          width: 42,
          height: 42,
          borderRadius: 21,
          backgroundColor: "#FFC75A",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name="location" color="#B96700" size={21} />
      </View>

      <View
        style={{
          position: "absolute",
          right: 18,
          top: 0,
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: "#F36B91",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name="medical" color={C.white} size={20} />
      </View>
    </View>
  );
}

export function CareContactsScreen() {
  const { state } = useCare();
  const careRecipientId = state.careRecipientId;
  const viewer =
    state.accessRole === "viewer" || state.accessRole === "patient";
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
      <Fade>
        <View style={{ gap: 7 }}>
          <Text
            style={[
              S.eyebrow,
              { color: "#74328F", fontSize: 10.5, letterSpacing: 2.45 },
            ]}
          >
            CARE CONTACTS + PROVIDER DIRECTORY
          </Text>
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: "DMSans_700Bold",
              fontSize: 34,
              lineHeight: 40,
              letterSpacing: -0.9,
              color: "#15133A",
            }}
          >
            Find the right care team fast.
          </Text>
          <Text
            style={{
              fontFamily: "DMSans_400Regular",
              fontSize: 15,
              lineHeight: 22,
              color: "#7A748A",
              maxWidth: 390,
            }}
          >
            Keep doctors, specialists, pharmacies, home health, insurance, and
            hospital departments in one place.
          </Text>
        </View>

        <Card
          style={{
            position: "relative",
            overflow: "hidden",
            minHeight: 214,
            borderRadius: 28,
            padding: 22,
            backgroundColor: "#5A246F",
            borderWidth: 0,
            shadowColor: themeShadow("#542267"),
            shadowOpacity: 0.18,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 9 },
            elevation: 4,
          }}
        >
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              width: 220,
              height: 220,
              borderRadius: 110,
              right: -66,
              top: -92,
              backgroundColor: "#FFFFFF0C",
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              width: 180,
              height: 180,
              borderRadius: 90,
              right: -100,
              bottom: -68,
              backgroundColor: "#A95CC21A",
            }}
          />

          <View style={S.between}>
            <View style={{ gap: 9 }}>
              <Text
                style={[
                  S.eyebrow,
                  { color: "#EEDDF5", fontSize: 10.5, letterSpacing: 2.5 },
                ]}
              >
                ACTIVE CARE PROFILE
              </Text>
              <Text
                style={{
                  fontFamily: "DMSans_700Bold",
                  fontSize: 29,
                  lineHeight: 34,
                  color: C.white,
                }}
              >
                {state.careRecipientName || "Care profile"}
              </Text>
              <View
                style={{
                  alignSelf: "flex-start",
                  paddingHorizontal: 11,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: "#A95CC252",
                }}
              >
                <Text
                  style={{
                    fontFamily: "DMSans_600SemiBold",
                    fontSize: 12,
                    color: C.white,
                  }}
                >
                  {state.accessRole === "owner"
                    ? "Owner access"
                    : state.accessRole === "caregiver"
                      ? "Caregiver access"
                      : "Viewer access"}
                </Text>
              </View>
            </View>

            <View
              style={{
                width: 70,
                height: 70,
                borderRadius: 35,
                backgroundColor: "#EBDDF4",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="person" color="#7D36A1" size={34} />
            </View>
          </View>

          <View
            style={{
              marginTop: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 18,
            }}
          >
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Icon name="people" color={C.white} size={27} />
              <View>
                <Text
                  style={{
                    fontFamily: "DMSans_700Bold",
                    fontSize: 20,
                    color: C.white,
                  }}
                >
                  {contacts.length}
                </Text>
                <Text style={[S.small, { color: "#EEDFF3" }]}>
                  {contacts.length === 1 ? "contact" : "contacts"}
                </Text>
              </View>
            </View>

            <View style={{ width: 1, height: 48, backgroundColor: "#FFFFFF38" }} />

            <View style={{ flex: 1.2, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Icon
                name={viewer ? "eye-outline" : "create-outline"}
                color={C.white}
                size={28}
              />
              <View>
                <Text
                  style={{
                    fontFamily: "DMSans_700Bold",
                    fontSize: 15,
                    color: C.white,
                  }}
                >
                  {viewer ? "Read-only" : "Can edit"}
                </Text>
                <Text style={[S.small, { color: "#EEDFF3" }]}>access</Text>
              </View>
            </View>
          </View>
        </Card>

        {Boolean(message) && (
          <Card
            style={{
              borderRadius: 20,
              padding: 15,
              backgroundColor: message.toLowerCase().includes("could not")
                ? C.redBg
                : "#F3ECF9",
            }}
          >
            <Text accessibilityRole="alert" style={S.body}>
              {message}
            </Text>
          </Card>
        )}

        {viewer && (
          <Card
            style={{
              borderRadius: 22,
              padding: 16,
              backgroundColor: "#F3ECF9",
              borderColor: "#E7DCEF",
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                backgroundColor: "#E7D8F2",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="eye-outline" size={25} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={S.h3}>Viewer access is read-only.</Text>
              <Text style={[S.small, { fontSize: 12.5, lineHeight: 18 }]}>
                You can view contacts, but only the Owner or a Caregiver can add
                or edit details.
              </Text>
            </View>
          </Card>
        )}

        {!viewer && !formOpen && (
          <Button title="Add provider" icon="add-outline" onPress={openAdd} />
        )}

        <View
          style={[
            S.input,
            {
              minHeight: 58,
              borderRadius: 22,
              paddingHorizontal: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 11,
            },
          ]}
        >
          <Icon name="search-outline" size={22} />
          <TextInput
            accessibilityLabel="Search care contacts"
            placeholder="Search name, specialty, pharmacy, phone..."
            placeholderTextColor="#B1A5B8"
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

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <DirectoryCategoryTile
            label="All"
            count={contacts.length}
            icon="people"
            iconBackground="#E9DDF4"
            iconColor="#74328F"
            selected={category === "all"}
            onPress={() => setCategory("all")}
          />
          {careContactCategories.map((item) => {
            const visual = categoryVisuals[item];
            return (
              <DirectoryCategoryTile
                key={item}
                label={careContactCategoryLabels[item]}
                count={categoryCounts.get(item) ?? 0}
                icon={visual.icon}
                iconBackground={visual.background}
                iconColor={visual.color}
                selected={category === item}
                onPress={() => setCategory(item)}
              />
            );
          })}
        </View>

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
              <Button title="Cancel" secondary disabled={busy} onPress={closeForm} />

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

        {loading ? (
          <Card
            style={{
              minHeight: 150,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ActivityIndicator color={C.purple} />
            <Txt>Loading provider directory…</Txt>
          </Card>
        ) : filtered.length ? (
          <View style={{ gap: 12 }}>
            {filtered.map((contact) => {
              const visual = categoryVisuals[contact.category];
              return (
                <Card
                  key={contact.id}
                  style={{ borderRadius: 22, padding: 17, gap: 13 }}
                >
                  <View style={S.between}>
                    <View
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 16,
                        backgroundColor: visual.background,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon name={visual.icon} color={visual.color} size={23} />
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={S.h3}>{contact.providerName}</Text>
                      <Text style={S.small}>
                        {careContactCategoryLabels[contact.category]}
                        {contact.specialty ? " · " + contact.specialty : ""}
                      </Text>
                    </View>
                    {!viewer && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={"Edit " + contact.providerName}
                        onPress={() => openEdit(contact)}
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 15,
                          backgroundColor: "#F3ECF9",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Icon name="create-outline" size={20} />
                      </Pressable>
                    )}
                  </View>

                  {Boolean(contact.organizationName) && (
                    <Txt>{contact.organizationName}</Txt>
                  )}

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

                  {Boolean(contact.address) && (
                    <View style={S.row}>
                      <Icon name="location-outline" size={17} />
                      <Txt style={{ flex: 1 }}>{contact.address}</Txt>
                    </View>
                  )}
                </Card>
              );
            })}
          </View>
        ) : (
          <Card
            style={{
              minHeight: 205,
              borderRadius: 24,
              padding: 18,
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
            }}
          >
            <EmptyDirectoryArt />
            <View style={{ flex: 1, gap: 8 }}>
              <Text
                style={{
                  fontFamily: "DMSans_700Bold",
                  fontSize: 17,
                  lineHeight: 22,
                  color: C.ink,
                }}
              >
                {contacts.length
                  ? "No contacts match this search."
                  : "No care contacts saved yet."}
              </Text>
              <Text style={[S.small, { fontSize: 12.5, lineHeight: 18 }]}>
                {contacts.length
                  ? "Try another name, specialty, or category."
                  : "The Owner or a Caregiver can add providers to this shared care profile."}
              </Text>

              {!contacts.length && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add provider"
                  accessibilityState={{ disabled: viewer }}
                  disabled={viewer}
                  onPress={openAdd}
                  style={({ pressed }) => ({
                    alignSelf: "flex-start",
                    minHeight: 42,
                    paddingHorizontal: 14,
                    borderRadius: 21,
                    backgroundColor: "#F0E5F8",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 7,
                    opacity: viewer ? 0.55 : pressed ? 0.72 : 1,
                  })}
                >
                  <Icon name="add" size={19} />
                  <Text
                    style={{
                      fontFamily: "DMSans_600SemiBold",
                      fontSize: 12.5,
                      color: C.purple,
                    }}
                  >
                    Add provider
                  </Text>
                </Pressable>
              )}
            </View>
          </Card>
        )}

        <Card
          style={{
            borderRadius: 22,
            padding: 16,
            backgroundColor: "#F6F0FA",
            borderColor: "#E9DEF0",
            flexDirection: "row",
            alignItems: "center",
            gap: 13,
          }}
        >
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 16,
              backgroundColor: "#E9DDF4",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="lock-closed-outline" size={23} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[S.h3, { fontSize: 14 }]}>Profile-specific privacy</Text>
            <Text style={[S.small, { fontSize: 12, lineHeight: 17 }]}>
              These contacts are shared only with people who already have access
              to this care profile.
            </Text>
          </View>
        </Card>
      </Fade>
    </Page>
  );
}
