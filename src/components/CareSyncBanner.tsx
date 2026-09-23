import React from "react";
import { Text } from "react-native";
import { careSyncLabel } from "../careResilience";
import { useCare } from "../store";
import { Button, C, Card, Icon, S, Txt } from "../ui";

export function CareSyncBanner() {
  const {
    state,
    syncStatus,
    lastSyncedAt,
    syncError,
    refresh,
  } = useCare();

  if (!state.hydrated || syncStatus === "synced") return null;

  return (
    <Card
      style={{
        backgroundColor: syncStatus === "stale" ? "#FFF9F2" : C.lavender,
      }}
    >
      <Icon
        name={syncStatus === "stale" ? "cloud-offline-outline" : "sync-outline"}
        color={syncStatus === "stale" ? C.rose : C.purple}
      />
      <Text style={S.h3}>
        {careSyncLabel({ status: syncStatus, lastSyncedAt })}
      </Text>
      {syncStatus === "stale" && (
        <>
          <Txt style={S.small}>
            EnVizion keeps the already-loaded session view available in memory.
            New changes still require a connection and are never silently queued,
            which avoids duplicate clinical or care records.
          </Txt>
          {Boolean(syncError) && <Txt style={S.small}>{syncError}</Txt>}
          <Button
            title="Retry connection"
            secondary
            icon="refresh-outline"
            onPress={() => void refresh()}
          />
        </>
      )}
    </Card>
  );
}
