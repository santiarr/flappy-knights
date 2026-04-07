<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of Flappy Knights with PostHog using `posthog-js`. A new `src/analytics.ts` module initializes PostHog on page load and wires up 9 game events via the existing Phaser `EventBus`. Direct `capture()` calls in `TitleScreen.ts` and `Game.ts` cover events that are not routed through the EventBus. Environment variables are stored in `.env` and never hardcoded.

| Event | Description | File |
|---|---|---|
| `game_start` | Game scene initializes (wave 1 begins) | `src/analytics.ts` (EventBus) |
| `game play started` | Player clicks PLAY / presses SPACE from title screen | `src/scenes/TitleScreen.ts` |
| `tutorial viewed` | Player opens the HOW TO PLAY screen; includes `is_first_play` | `src/scenes/TitleScreen.ts` |
| `game_over` | Player loses all lives; includes `score`, `wave_reached`, `best_combo`, `time_played_seconds`, `is_new_best` | `src/analytics.ts` (EventBus) |
| `game_restart` | Player clicks PLAY AGAIN or presses R after game over | `src/analytics.ts` (EventBus) |
| `wave_complete` | All enemies in a wave are cleared; includes `wave`, `score` | `src/analytics.ts` (EventBus) |
| `enemy_defeated` | Player defeats an enemy; includes `enemy_type`, `points`, `combo`, `wave` | `src/analytics.ts` (EventBus) |
| `pterodactyl_defeated` | Player defeats the pterodactyl in a survival wave | `src/analytics.ts` (EventBus) |
| `combo_achieved` | Player hits a 3×, 5×, or 10× combo milestone | `src/analytics.ts` (EventBus) |
| `player_damaged` | Player is hit by an enemy; includes `wave`, `score`, `lives_remaining` | `src/analytics.ts` (EventBus) |
| `bonus life earned` | Player reaches a score threshold and earns an extra life | `src/scenes/Game.ts` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics:** https://us.posthog.com/project/372235/dashboard/1438598
- **Daily active players:** https://us.posthog.com/project/372235/insights/jz9fuaiY
- **Session-to-game-over funnel:** https://us.posthog.com/project/372235/insights/VWfBk5FG
- **Average score per session:** https://us.posthog.com/project/372235/insights/xyRkUoeP
- **Retry rate (restarts / game overs):** https://us.posthog.com/project/372235/insights/HHCg65Be
- **Wave completion drop-off:** https://us.posthog.com/project/372235/insights/8uiz4yhW

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
