// app.js

let match = null;
let turnNumber = 0;           // Aufnahme-Nummer (1,2,3...)
let dartsInCurrentTurn = 0;   // 0..3
let history = [];             // für Undo
let currentTurnStartScore = null; // Score zu Beginn der Aufnahme

const DARTS_PER_TURN = 3;

const setupCard = document.getElementById('setup-card');
const scoringCard = document.getElementById('scoring-card');

const startBtn = document.getElementById('start-match-btn');
const scoreInput = document.getElementById('score-input');
const submitScoreBtn = document.getElementById('submit-score-btn');
const undoBtn = document.getElementById('undo-btn');
const abortBtn = document.getElementById('abort-btn');
const statusEl = document.getElementById('status');
const matchInfoEl = document.getElementById('match-info');
const currentThrowerEl = document.getElementById('current-thrower');
const turnDartsEl = document.getElementById('turn-darts');
const dartStateTextEl = document.getElementById('dart-state-text');
const dartCurrentPointsEl = document.getElementById('dart-current-points');

const turnSummaryEl = document.getElementById('turn-summary');
const turnSummaryTextEl = document.getElementById('turn-summary-text');
const confirmTurnBtn = document.getElementById('confirm-turn-btn');

const p1Box = document.getElementById('p1-box');
const p2Box = document.getElementById('p2-box');
const p1NameEl = document.getElementById('p1-name');
const p2NameEl = document.getElementById('p2-name');
const p1ScoreEl = document.getElementById('p1-score');
const p2ScoreEl = document.getElementById('p2-score');

const matchTypeSelect = document.getElementById('match-type');
const doubleRow = document.getElementById('double-row');

const scoreButtonsContainer = document.getElementById('score-buttons');
const multBtns = document.querySelectorAll('.mult-btn');
const missBtn = document.getElementById('miss-btn');

const winnerModal = document.getElementById('winner-modal');
const winnerTextEl = document.getElementById('winner-text');
const winnerCloseBtn = document.getElementById('winner-close-btn');

// aktueller Sektor & Multiplikator
let currentSegment = null;    // kein Feld gewählt zu Beginn
let currentMultiplier = 1;    // 1=Einfach, 2=Double, 3=Triple

let segmentButtons = [];
let currentTurnDarts = [];    // [{points, multiplier}]
let turnSummaryPending = false;
let matchFinished = false;

// ------------------------------------------------------------
// Helper
// ------------------------------------------------------------
function clearSegmentSelection() {
  segmentButtons.forEach(btn => btn.classList.remove('segment-selected'));
}

function updateGoldTwentyHighlight() {
  segmentButtons.forEach(btn => {
    const seg = parseInt(btn.dataset.segment, 10);
    // 20 wird golden, sobald Triple ausgewählt ist
    const shouldBeGold = (seg === 20 && currentMultiplier === 3);
    btn.classList.toggle('segment-gold', shouldBeGold);
  });
}

function clearMultiplierSelection() {
  multBtns.forEach(btn => btn.classList.remove('mult-selected'));
}

function hideTurnSummary() {
  if (turnSummaryEl) turnSummaryEl.style.display = 'none';
  if (turnSummaryTextEl) turnSummaryTextEl.textContent = '';
}

function showWinnerModal(playerName, teamName) {
  if (!winnerModal || !winnerTextEl) return;
  winnerTextEl.textContent = `${playerName} – Gewinner für ${teamName}`;
  winnerModal.style.display = 'flex';
}

// Anzeige komplett zurücksetzen: kein Pfeil gewählt
function resetDartStateDisplay() {
  if (dartStateTextEl) dartStateTextEl.textContent = '–';
  if (dartCurrentPointsEl) dartCurrentPointsEl.textContent = '--';
  if (scoreInput) scoreInput.value = '';
}

// Anzeige auf den letzten geworfenen Pfeil setzen
function updateDartStateFromLastDart() {
  if (!currentTurnDarts.length) {
    resetDartStateDisplay();
    return;
  }
  const last = currentTurnDarts[currentTurnDarts.length - 1];
  const label = formatDartDisplay(last.points, last.multiplier);
  if (dartStateTextEl) dartStateTextEl.textContent = label;
  if (dartCurrentPointsEl) dartCurrentPointsEl.textContent = last.points;
  if (scoreInput) scoreInput.value = last.points;
}

function showTurnSummary(rot, team, remaining) {
  if (!turnSummaryEl || !turnSummaryTextEl) return;

  const parts = currentTurnDarts.map(d => formatDartDisplay(d.points, d.multiplier));
  const total = currentTurnDarts.reduce((a, d) => a + d.points, 0);

  turnSummaryTextEl.textContent =
    `Aufnahme ${turnNumber} – ${rot.playerName} (${team.name}): ` +
    `${parts.join(' | ')} = ${total} Punkte (Rest: ${remaining})`;

  turnSummaryEl.style.display = 'block';
}

// ------------------------------------------------------------
// Segment-Buttons 0–20 & 25 erzeugen
// ------------------------------------------------------------
function createScoreButtons() {
  if (!scoreButtonsContainer) return;

  for (let s = 0; s <= 20; s++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.segment = String(s);
    btn.textContent = s;
    scoreButtonsContainer.appendChild(btn);
    segmentButtons.push(btn);

    btn.addEventListener('click', () => {
      const score = handleSegmentClick(s);
      if (score !== null) {
        applyDartScore(score);
      }
    });
  }

  // Bull 25
  const bullBtn = document.createElement('button');
  bullBtn.type = 'button';
  bullBtn.dataset.segment = '25';
  bullBtn.textContent = '25';
  scoreButtonsContainer.appendChild(bullBtn);
  segmentButtons.push(bullBtn);

  bullBtn.addEventListener('click', () => {
    const score = handleSegmentClick(25);
    if (score !== null) {
      applyDartScore(score);
    }
  });

  // zu Beginn Platzhalter anzeigen
  resetDartStateDisplay();
}

function handleSegmentClick(segment) {
  if (!match || matchFinished) {
    statusEl.textContent = 'Bitte zuerst ein Match starten.';
    return null;
  }
  if (turnSummaryPending) {
    statusEl.textContent =
      'Bitte zuerst die aktuelle Aufnahme bestätigen oder mit Undo korrigieren.';
    return null;
  }

  currentSegment = segment;
  clearSegmentSelection();
  segmentButtons.forEach(btn => {
    btn.classList.toggle(
      'segment-selected',
      parseInt(btn.dataset.segment, 10) === segment
    );
  });

  updateGoldTwentyHighlight();

  return calculateCurrentScore();
}

function calculateCurrentScore() {
  if (currentSegment === null) return 0;
  let score = currentSegment * currentMultiplier;
  if (currentSegment === 0) score = 0;
  if (score > 60) score = 60;
  return score;
}

function setMultiplier(mult) {
  if (currentMultiplier === mult) {
    currentMultiplier = 1; // erneut klicken = zurück auf Einfach
  } else {
    currentMultiplier = mult;
  }

  clearMultiplierSelection();
  multBtns.forEach(btn => {
    const btnMult = parseInt(btn.dataset.mult, 10);
    btn.classList.toggle('mult-selected', btnMult === currentMultiplier);
  });

  updateGoldTwentyHighlight();
}

createScoreButtons();

// Multiplikator-Buttons
multBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    if (!match || matchFinished) {
      statusEl.textContent = 'Bitte zuerst ein Match starten.';
      return;
    }
    if (turnSummaryPending) {
      statusEl.textContent =
        'Bitte zuerst die aktuelle Aufnahme bestätigen oder mit Undo korrigieren.';
      return;
    }
    const mult = parseInt(btn.dataset.mult, 10);
    setMultiplier(mult);
  });
});

// Miss / 0 Punkte – Button ausblenden
if (missBtn) {
  missBtn.style.display = 'none';
}

// ------------------------------------------------------------
// Matchtyp Umschalten
// ------------------------------------------------------------
if (matchTypeSelect) {
  matchTypeSelect.addEventListener('change', () => {
    if (!doubleRow) return;
    doubleRow.style.display =
      matchTypeSelect.value === 'double' ? 'flex' : 'none';
  });
}

// ------------------------------------------------------------
// Match starten
// ------------------------------------------------------------
if (startBtn) {
  startBtn.addEventListener('click', () => {
    const matchType = matchTypeSelect.value;

    const modeValue = document.getElementById('mode').value;
    const [pointsStr, outType] = modeValue.split('-');
    const startPoints = parseInt(pointsStr, 10);

    const p1 = (document.getElementById('player1').value || 'Spieler 1').trim();
    const p2 = (document.getElementById('player2').value || 'Spieler 2').trim();
    const p3 = (document.getElementById('player3').value || 'Spieler 3').trim();
    const p4 = (document.getElementById('player4').value || 'Spieler 4').trim();

    if (!p1 || !p2) {
      alert('Bitte mindestens Spieler 1 und Spieler 2 wählen.');
      return;
    }

    if (matchType === 'double') {
      const team1Name = `${p1} & ${p3}`;
      const team2Name = `${p2} & ${p4}`;

      match = {
        id: Date.now(),
        type: 'double',
        startPoints,
        outType,
        teams: [
          { id: 'A', name: team1Name, players: [p1, p3], score: startPoints },
          { id: 'B', name: team2Name, players: [p2, p4], score: startPoints }
        ],
        rotation: [
          { teamIndex: 0, playerName: p1 },
          { teamIndex: 1, playerName: p2 },
          { teamIndex: 0, playerName: p3 },
          { teamIndex: 1, playerName: p4 }
        ],
        currentRotationIndex: 0,
        throws: []
      };
    } else {
      match = {
        id: Date.now(),
        type: 'single',
        startPoints,
        outType,
        teams: [
          { id: 'A', name: p1, players: [p1], score: startPoints },
          { id: 'B', name: p2, players: [p2], score: startPoints }
        ],
        rotation: [
          { teamIndex: 0, playerName: p1 },
          { teamIndex: 1, playerName: p2 }
        ],
        currentRotationIndex: 0,
        throws: []
      };
    }

    matchFinished = false;
    turnNumber = 0;
    dartsInCurrentTurn = 0;
    history = [];
    currentTurnDarts = [];
    currentTurnStartScore = null;
    turnSummaryPending = false;
    hideTurnSummary();
    updateTurnDartsDisplay();

    currentSegment = null;
    currentMultiplier = 1;
    clearSegmentSelection();
    clearMultiplierSelection();
    resetDartStateDisplay();

    initScoringView();
  });
}

// ------------------------------------------------------------
// Scoring-View initialisieren
// ------------------------------------------------------------
function initScoringView() {
  if (setupCard) setupCard.style.display = 'none';
  if (scoringCard) scoringCard.style.display = 'block';

  if (match.type === "single") {
    p1NameEl.textContent = match.teams[0].players[0];
    p2NameEl.textContent = match.teams[1].players[0];
  }

  if (match.type === "double") {
    p1NameEl.textContent = match.teams[0].players.join(" | ");
    p2NameEl.textContent = match.teams[1].players.join(" | ");
}

  updateScores();
  updateCurrentThrower();
  highlightCurrentTeam();

  const typeLabel = match.type === 'double' ? 'Doppel' : 'Einzel';
  const outLabel = match.outType === 'double' ? 'Double Out' : 'Single Out';

  matchInfoEl.textContent =
    `Modus: ${match.startPoints} ${outLabel} | Typ: ${typeLabel}`;

  statusEl.textContent = '';
}

function updateScores() {
  p1ScoreEl.textContent = match.teams[0].score;
  p2ScoreEl.textContent = match.teams[1].score;
}

function updateCurrentThrower() {
  const rot = match.rotation[match.currentRotationIndex];
  const team = match.teams[rot.teamIndex];

  const playerName = rot.playerName;    // ← hier der echte Name
  const teamName = team.name;           // Team-Name (oder Spielername bei Single)
  const dartLabel = dartsInCurrentTurn + 1;

  currentThrowerEl.textContent =
    `Am Board: ${playerName} (${teamName}) • Pfeil ${dartLabel}/3`;
}

function highlightCurrentTeam() {
  p1Box.classList.remove('active');
  p2Box.classList.remove('active');

  const rot = match.rotation[match.currentRotationIndex];
  if (rot.teamIndex === 0) {
    p1Box.classList.add('active');
  } else {
    p2Box.classList.add('active');
  }
}

// „18“, „D9“, „T20“, „25“, „0“
function formatDartDisplay(points, multiplier) {
  if (points === 0) return '0';
  const segment = multiplier === 1 ? points : points / multiplier;
  if (multiplier === 2) return `D${segment}`;
  if (multiplier === 3) return `T${segment}`;
  return `${segment}`;
}

function updateTurnDartsDisplay() {
  if (!turnDartsEl) return;
  if (currentTurnDarts.length === 0) {
    turnDartsEl.textContent = '';
    return;
  }
  const parts = currentTurnDarts.map(d =>
    formatDartDisplay(d.points, d.multiplier)
  );
  turnDartsEl.textContent = `Aktuelle Aufnahme: ${parts.join(' | ')}`;
}

// ------------------------------------------------------------
// Bust-Helfer: komplette Aufnahme zurücksetzen & Gegner dran
// ------------------------------------------------------------
function handleBust(rot, team) {
  const restored = currentTurnStartScore != null
    ? currentTurnStartScore
    : team.score;

  team.score = restored;

  dartsInCurrentTurn = 0;
  currentTurnDarts = [];
  currentTurnStartScore = null;
  turnSummaryPending = false;

  hideTurnSummary();
  updateScores();
  updateTurnDartsDisplay();

  // Nächster Spieler
  match.currentRotationIndex =
    (match.currentRotationIndex + 1) % match.rotation.length;

  currentSegment = null;
  currentMultiplier = 1;
  clearSegmentSelection();
  clearMultiplierSelection();
  resetDartStateDisplay();

  updateCurrentThrower();
  highlightCurrentTeam();

  statusEl.textContent =
    `Bust! ${rot.playerName} überwirft – Rest wieder ${restored}.`;
}

// ------------------------------------------------------------
// Pfeil-Logik
// ------------------------------------------------------------
function applyDartScore(score) {
  if (!match) {
    statusEl.textContent = 'Bitte zuerst ein Match starten.';
    return;
  }
  if (matchFinished) {
    statusEl.textContent = 'Match ist bereits beendet.';
    return;
  }
  if (turnSummaryPending) {
    statusEl.textContent =
      'Bitte zuerst die aktuelle Aufnahme bestätigen oder mit Undo korrigieren.';
    return;
  }
  if (score < 0 || score > 60) {
    statusEl.textContent = 'Ungültiger Pfeil-Score.';
    return;
  }

  const rot = match.rotation[match.currentRotationIndex];
  const team = match.teams[rot.teamIndex];
  const isDoubleOut = match.outType === 'double';
  const thisMultiplier = currentMultiplier;

  // Aufnahmebeginn: Start-Score merken
  if (dartsInCurrentTurn === 0) {
    turnNumber += 1;
    currentTurnDarts = [];
    currentTurnStartScore = team.score;
  }

  const scoreBefore = team.score;
  const newScore = scoreBefore - score;

  // Zustand vor diesem Dart für Undo
  history.push({
    teamIndex: rot.teamIndex,
    prevScore: scoreBefore,
    rotationIndexBefore: match.currentRotationIndex,
    prevDartsInCurrentTurn: dartsInCurrentTurn,
    prevTurnNumber: turnNumber,
    prevTurnDarts: [...currentTurnDarts],
    prevTurnSummaryPending: turnSummaryPending,
    prevMatchFinished: matchFinished,
    prevTurnStartScore: currentTurnStartScore
  });

  // ---- Bust-Logik je nach Modus ----
  if (isDoubleOut) {
    // Double Out: 0 nur mit Double, 1 ist Bust, <0 ist Bust
    if (newScore < 0 || newScore === 1 ||
        (newScore === 0 && thisMultiplier !== 2)) {
      handleBust(rot, team);
      return;
    }
  } else {
    // Single Out: <0 = Bust
    if (newScore < 0) {
      handleBust(rot, team);
      return;
    }
  }

  // kein Bust -> Dart zählt
  dartsInCurrentTurn += 1;
  team.score = newScore;

  currentTurnDarts.push({
    points: score,
    multiplier: thisMultiplier
  });

  if (match.throws) {
    match.throws.push({
      turnNumber,
      dartInTurn: dartsInCurrentTurn,
      teamId: team.id,
      teamName: team.name,
      playerName: rot.playerName,
      segment: currentSegment,       
      multiplier: thisMultiplier,    
      score: score,                  
      scoreBefore: scoreBefore,      
      remaining: newScore,
      timestamp: new Date().toISOString()
    });
  }

  updateScores();
  updateTurnDartsDisplay();
  updateDartStateFromLastDart();

  // Nach dem Wurf: Auswahl für nächsten Wurf zurücksetzen
  currentSegment = null;
  currentMultiplier = 1;
  clearSegmentSelection();
  clearMultiplierSelection();
  updateGoldTwentyHighlight();

  // Check-Out?
  if (newScore === 0) {
    const outText =
      match.outType === 'double'
        ? ' (Double Out – letzter Dart war Doppel ✅)'
        : '';

    statusEl.textContent =
      `${rot.playerName} macht das Leg für ${team.name} zu! 🎉${outText}`;

    matchFinished = true;
    dartsInCurrentTurn = 0;
    currentTurnDarts = [];
    currentTurnStartScore = null;
    turnSummaryPending = false;
    hideTurnSummary();
    updateTurnDartsDisplay();

    showWinnerModal(rot.playerName, team.name);

    // >>> HIER speichern wir in Firestore <<<
    saveMatchToFirestore(rot.playerName, team.name);

    return;
  }

  // Aufnahme voll -> Zusammenfassung
  if (dartsInCurrentTurn >= DARTS_PER_TURN) {
    turnSummaryPending = true;
    showTurnSummary(rot, team, newScore);
    statusEl.textContent =
      'Aufnahme abgeschlossen – bitte bestätigen oder mit Undo korrigieren.';
    return;
  }

  updateCurrentThrower();
  highlightCurrentTeam();

  statusEl.textContent =
    `${rot.playerName} wirft ${score} Punkte (Rest: ${newScore}).`;
}

// ------------------------------------------------------------
// Aufnahme bestätigen – Nächster Spieler
// ------------------------------------------------------------
if (confirmTurnBtn) {
  confirmTurnBtn.addEventListener('click', () => {
    if (!match || !turnSummaryPending) return;

    turnSummaryPending = false;
    hideTurnSummary();

    dartsInCurrentTurn = 0;
    currentTurnDarts = [];
    currentTurnStartScore = null;

    match.currentRotationIndex =
      (match.currentRotationIndex + 1) % match.rotation.length;

    clearSegmentSelection();
    clearMultiplierSelection();
    currentSegment = null;
    currentMultiplier = 1;
    resetDartStateDisplay();

    updateCurrentThrower();
    highlightCurrentTeam();
    updateTurnDartsDisplay();

    const rot = match.rotation[match.currentRotationIndex];
    statusEl.textContent =
      `Aufnahme bestätigt – Nächster Spieler: ${rot.playerName}`;
  });
}

// ------------------------------------------------------------
// Manuelle Eingabe
// ------------------------------------------------------------
if (submitScoreBtn) {
  submitScoreBtn.addEventListener('click', () => {
    const value = parseInt(scoreInput.value, 10);
    if (isNaN(value) || value < 0 || value > 60) {
      statusEl.textContent = 'Bitte gültigen Pfeil-Score (0–60) eingeben.';
      return;
    }
    applyDartScore(value);
  });
}

// ------------------------------------------------------------
// Undo
// ------------------------------------------------------------
if (undoBtn) {
  undoBtn.addEventListener('click', () => {
    if (!match) {
      statusEl.textContent = 'Kein aktives Match zum Rückgängigmachen.';
      return;
    }
    if (history.length === 0) {
      statusEl.textContent = 'Nichts zum Rückgängigmachen.';
      return;
    }

    const last = history.pop();

    if (match.throws && match.throws.length > 0) {
      match.throws.pop();
    }

    match.currentRotationIndex = last.rotationIndexBefore;
    match.teams[last.teamIndex].score = last.prevScore;
    dartsInCurrentTurn = last.prevDartsInCurrentTurn;
    turnNumber = last.prevTurnNumber;
    currentTurnDarts = last.prevTurnDarts;
    turnSummaryPending = last.prevTurnSummaryPending;
    matchFinished = last.prevMatchFinished;
    currentTurnStartScore = last.prevTurnStartScore;

    if (!turnSummaryPending) {
      hideTurnSummary();
    } else {
      const rot = match.rotation[match.currentRotationIndex];
      const team = match.teams[rot.teamIndex];
      const remaining = team.score;
      showTurnSummary(rot, team, remaining);
    }

    updateScores();
    updateCurrentThrower();
    highlightCurrentTeam();
    updateTurnDartsDisplay();
    updateDartStateFromLastDart();

    if (winnerModal) winnerModal.style.display = 'none';

    statusEl.textContent = 'Letzter Pfeil rückgängig gemacht.';
  });
}

// ------------------------------------------------------------
// Match abbrechen
// ------------------------------------------------------------
if (abortBtn) {
  abortBtn.addEventListener('click', () => {
    if (!match) {
      statusEl.textContent = 'Kein aktives Match zum Abbrechen.';
      return;
    }
    const ok = confirm('Match wirklich abbrechen? Alle Würfe gehen verloren.');
    if (!ok) return;
    resetMatchToSetup();
  });
}

function resetMatchToSetup() {
  match = null;
  matchFinished = false;
  turnNumber = 0;
  dartsInCurrentTurn = 0;
  history = [];
  currentTurnDarts = [];
  currentTurnStartScore = null;
  turnSummaryPending = false;
  hideTurnSummary();
  updateTurnDartsDisplay();

  if (scoringCard) scoringCard.style.display = 'none';
  if (setupCard) setupCard.style.display = 'block';

  currentSegment = null;
  currentMultiplier = 1;
  clearSegmentSelection();
  clearMultiplierSelection();
  resetDartStateDisplay();
  updateGoldTwentyHighlight();

  statusEl.textContent = '';
  if (scoreInput) scoreInput.value = '';

  if (winnerModal) winnerModal.style.display = 'none';
}

async function saveMatchToFirestore(winnerName, winnerTeamName) {
  try {
    if (!match || !match.throws || match.throws.length === 0) {
      console.warn('Nichts zu speichern.');
      return;
    }

    // Prüfen, ob Firestore global verfügbar ist (wird in index.html gesetzt)
    if (!window.db || !window.addDoc || !window.collection || !window.serverTimestamp) {
      console.error("Firestore ist nicht initialisiert (window.db / addDoc / collection / serverTimestamp fehlen).");
      return;
    }

    // 1) Basis-Infos zum Match
    const modeEl = document.getElementById("mode");
    let startPoints = match.startPoints;
    let outType = match.outType;

    if (modeEl) {
      const modeInfo = modeEl.value.split("-");
      startPoints = parseInt(modeInfo[0], 10);
      outType = modeInfo[1];
    }

    const playersFlat = match.teams.map(t => t.players).flat();

    const matchDoc = {
      matchId: match.id,
      createdAt: window.serverTimestamp(),
      type: match.type,
      startPoints: startPoints,
      outType: outType,
      players: playersFlat,
      teamA: match.teams[0].name,
      teamB: match.teams[1].name,
      winnerName: winnerName,
      winnerTeam: winnerTeamName
    };

    // 2) Match-Dokument in Sammlung "matches" anlegen
    const matchRef = await window.addDoc(
      window.collection(window.db, "matches"),
      matchDoc
    );

    // 3) Alle Würfe in Sammlung "throws" speichern
    const throwsCol = window.collection(window.db, "throws");

    for (const t of match.throws) {
      await window.addDoc(throwsCol, {
        matchDocId: matchRef.id,   // Firestore-ID des Matches
        matchId: match.id,         // deine eigene Match-ID
        turnNumber: t.turnNumber,
        dartInTurn: t.dartInTurn,
        teamId: t.teamId,
        teamName: t.teamName,
        playerName: t.playerName,
        segment: t.segment,
        multiplier: t.multiplier,
        score: t.score,
        scoreBefore: t.scoreBefore,
        remaining: t.remaining,
        isCheckout: t.remaining === 0,
        timestamp: t.timestamp
      });
    }

    console.log("Match + Würfe in Firestore gespeichert.");
  } catch (err) {
    console.error("Fehler beim Speichern in Firestore:", err);
    statusEl.textContent = "Fehler beim Speichern des Matches (siehe Konsole).";
  }
}

// ------------------------------------------------------------
// Winner-Modal Button
// ------------------------------------------------------------
if (winnerCloseBtn) {
  winnerCloseBtn.addEventListener('click', () => {
    resetMatchToSetup();
  });
}
