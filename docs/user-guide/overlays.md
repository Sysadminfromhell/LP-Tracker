# OBS Overlays

LP-Tracker offers player overlays that can be used as OBS Browser Sources.

## Create an overlay

1. Open `/overlay-generator`.
2. Select the player and event.
3. Copy the generated URL.
4. Add an OBS **Browser Source** and paste the URL.
5. Adjust source dimensions to suit your scene.

Stable player-specific overlay routes follow this pattern:

```text
/overlay/events/:eventId/players/:playerId
```

Some older paths are redirected for compatibility. Use the generator when creating new OBS scenes.

If data is missing, confirm that the event/player IDs exist, the player has data for the selected event and OBS can reach the application API. See [Troubleshooting](../operations/troubleshooting.md).
