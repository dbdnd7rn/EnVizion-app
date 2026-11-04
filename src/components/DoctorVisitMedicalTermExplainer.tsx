import React, { useRef, useState } from "react";
import { ActivityIndicator, Pressable, Switch, Text, TextInput, View } from "react-native";
import { themeBackground, themeBorder, themeForeground } from "../themeColors";
import { explainDoctorVisitTerm, type DoctorVisitTermAnswer } from "../doctorVisitTermExplanation";
import { Button, C, Card, Icon, S, Txt } from "../ui";

const sampleTerms = ["Tachycardia", "Edema", "Benign"];

export function DoctorVisitMedicalTermExplainer({ visitId }: { visitId: string }) {
  const [term, setTerm] = useState("");
  const [phrase, setPhrase] = useState("");
  const [allowAi, setAllowAi] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [result, setResult] = useState<DoctorVisitTermAnswer | null>(null);
  const [explainedTerm, setExplainedTerm] = useState("");
  const [error, setError] = useState("");
  const version = useRef(0);

  function changeTerm(value: string) {
    version.current++;
    setTerm(value);
    setResult(null);
    setError("");
  }

  function changePhrase(value: string) {
    version.current++;
    setPhrase(value);
    setResult(null);
    setError("");
  }

  async function askAi() {
    const clean = term.trim();
    if (explaining) return;
    if (!clean || clean.length > 160) {
      setError("Enter a medical word or short phrase (up to 160 characters).");
      return;
    }
    if (!allowAi) {
      setError("Confirm the AI-sharing option before requesting an explanation.");
      return;
    }
    setError("");
    setResult(null);
    setExplaining(true);
    const current = ++version.current;
    try {
      const explanation = await explainDoctorVisitTerm({
        visitId,
        term: clean,
        context: phrase.trim(),
      });
      if (current !== version.current) return;
      setExplainedTerm(clean);
      setResult(explanation);
    } catch (reason) {
      if (current !== version.current) return;
      setError(
        reason instanceof Error
          ? reason.message
          : "The explainer is unavailable right now. Please ask the clinician.",
      );
    } finally {
      setExplaining(false);
    }
  }

  return (
    <Card style={{ backgroundColor: themeBackground("#FAF6FC"), gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
        <View style={{
          height: 44, width: 44, borderRadius: 16,
          alignItems: "center", justifyContent: "center",
          backgroundColor: themeBackground("#EADDF4"),
        }}>
          <Icon name="chatbubble-ellipses-outline" size={23} color={C.purple} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={S.h2}>Explain a medical word</Text>
          <Txt style={S.small}>Understand a term you heard during or after the visit.</Txt>
        </View>
      </View>

      <Txt>
        Enter a medical term and get a short explanation in everyday language,
        plus a question you can ask the clinician.
      </Txt>

      <View style={{ gap: 7 }}>
        <Text style={[S.h3, { fontSize: 13 }]}>Medical word or short phrase</Text>
        <TextInput
          accessibilityLabel="Medical word or short phrase to explain"
          value={term}
          maxLength={160}
          autoCapitalize="sentences"
          onChangeText={changeTerm}
          placeholder="e.g., tachycardia"
          placeholderTextColor={themeForeground("#998CA5")}
          style={S.input}
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
          {sampleTerms.map(item => (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityLabel={"Explain " + item}
              onPress={() => changeTerm(item)}
              style={{
                paddingVertical: 7, paddingHorizontal: 12, borderRadius: 18,
                borderWidth: 1, borderColor: themeBorder("#E0CFEA"),
                backgroundColor: themeBackground("#F3EAF8"),
              }}
            >
              <Text style={[S.small, { color: themeForeground(C.purple) }]}>{item}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ gap: 7 }}>
        <Text style={[S.h3, { fontSize: 13 }]}>Optional short phrase for context</Text>
        <TextInput
          accessibilityLabel="Optional phrase where you heard the term"
          value={phrase}
          maxLength={450}
          multiline
          numberOfLines={2}
          onChangeText={changePhrase}
          placeholder="What did the clinician say? Avoid names or personal details."
          placeholderTextColor={themeForeground("#998CA5")}
          style={[S.input, { minHeight: 75, textAlignVertical: "top" }]}
        />
        <Txt style={S.small}>
          Only what you enter here is used as context. Saved notes and transcripts
          are never sent automatically.
        </Txt>
      </View>

      <View style={{
        padding: 12, borderRadius: 17,
        backgroundColor: themeBackground("#EFE6F7"),
        gap: 8,
      }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Switch
            accessibilityLabel="Allow sending only my typed term and phrase to the AI service"
            value={allowAi}
            onValueChange={value => {
              setAllowAi(value);
              if (!value) {
                version.current++;
                setResult(null);
              }
              setError("");
            }}
            trackColor={{ true: C.purple }}
          />
          <Text style={[S.body, { flex: 1, fontSize: 13 }]}>
            I agree to send only the text I entered to the AI service for an explanation.
          </Text>
        </View>
        <Txt style={S.small}>
          Avoid names, dates of birth, identifiers and other personal health details.
          Results are not saved to the patient record or shared with family.
        </Txt>
      </View>

      <Button
        title={explaining ? "Explaining…" : "Explain with AI"}
        icon="sparkles-outline"
        disabled={explaining || !allowAi || !term.trim()}
        onPress={() => void askAi()}
      />

      {explaining && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
          <ActivityIndicator color={C.purple} />
          <Txt style={S.small}>Preparing a simple explanation…</Txt>
        </View>
      )}
      {Boolean(error) && (
        <Card style={{ backgroundColor: themeBackground("#FFF1F3"), borderColor: themeBorder("#F4CED7") }}>
          <Text accessibilityRole="alert" style={[S.body, { color: themeForeground("#A42D4B") }]}>
            {error}
          </Text>
        </Card>
      )}

      {result && allowAi && (
        <Card style={{ gap: 11, backgroundColor: themeBackground("#FFFFFF") }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name="book-outline" color={C.purple} size={22} />
            <Text style={S.h2}>{explainedTerm}</Text>
          </View>
          <Text style={[S.small, { color: themeForeground(C.purple) }]}>
            {result.source === "glossary"
              ? "Built-in medical glossary · AI service unavailable"
              : "AI-generated general explanation"}
          </Text>
          {Boolean(result.notice) && (
            <View style={{ padding: 10, borderRadius: 13, backgroundColor: themeBackground("#F4EAF9") }}>
              <Txt style={S.small}>{result.notice}</Txt>
            </View>
          )}
          <View style={{ gap: 4 }}>
            <Text style={S.h3}>{result.known ? "In simple words" : "Meaning not confirmed"}</Text>
            <Txt>{result.plainMeaning}</Txt>
          </View>
          {Boolean(result.everydayExample) && (
            <View style={{ gap: 4 }}>
              <Text style={S.h3}>An everyday example</Text>
              <Txt>{result.everydayExample}</Txt>
            </View>
          )}
          <View style={{ gap: 4 }}>
            <Text style={S.h3}>Ask the clinician</Text>
            <Txt>{result.questionForClinician}</Txt>
          </View>
          <View style={{ gap: 6 }}>
            <Icon name="information-circle-outline" size={19} color={C.purple} />
            <Txt style={S.small}>{result.uncertainty}</Txt>
          </View>
        </Card>
      )}

      <Txt style={S.small}>
        AI explanations may be incorrect or incomplete. They are for general
        understanding only, not a diagnosis or treatment plan. For urgent symptoms,
        seek immediate medical help rather than relying on this tool.
      </Txt>
    </Card>
  );
}
