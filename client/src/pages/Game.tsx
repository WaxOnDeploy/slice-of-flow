import { useState, useEffect, useRef, useCallback } from 'react';

// ============================================================
// ZORK-STYLE AGILE TEXT ADVENTURE GAME
// "The Quest for the Golden Sprint"
// Retro CRT terminal aesthetic, green text on black
// 30+ rooms, inventory system, Agile-themed puzzles
// ============================================================

interface Room {
  id: string;
  name: string;
  description: string;
  exits: Record<string, string>;
  items?: string[];
  enemies?: string[];
  locked?: Record<string, { requires: string; message: string }>;
  special?: string;
}

interface GameState {
  currentRoom: string;
  inventory: string[];
  visited: string[];
  flags: Record<string, boolean>;
  health: number;
  score: number;
  moves: number;
}

const ROOMS: Record<string, Room> = {
  lobby: {
    id: 'lobby',
    name: 'Agile Tower Lobby',
    description: 'You stand in the grand lobby of Agile Tower. Motivational posters line the walls — "Move Fast, Break Nothing" and "Velocity Is Not Speed." A reception desk sits unmanned. Elevators to the NORTH lead up. A dark corridor leads EAST. The exit is SOUTH but the doors are locked with a sprint-shaped keycard reader.',
    exits: { north: 'elevator_hall', east: 'dark_corridor', south: 'exit' },
    items: ['visitor_badge'],
    locked: { south: { requires: 'golden_sprint_trophy', message: 'The exit requires the Golden Sprint Trophy to unlock. Your quest is not yet complete.' } }
  },
  elevator_hall: {
    id: 'elevator_hall',
    name: 'Elevator Hall',
    description: 'Three elevators stand before you. The left one (WEST) goes to the Scrum Floor. The middle one (NORTH) goes to the Executive Suite. The right one (EAST) goes to the DevOps Dungeon. A sign reads: "Middle elevator requires C-Suite Access Badge." The lobby is SOUTH.',
    exits: { west: 'scrum_floor', north: 'executive_suite', east: 'devops_dungeon', south: 'lobby' },
    locked: { north: { requires: 'csuite_badge', message: 'The elevator beeps angrily. "C-Suite Access Required." You need a special badge.' } }
  },
  dark_corridor: {
    id: 'dark_corridor',
    name: 'The Dark Corridor',
    description: 'A dimly lit hallway stretches before you. Flickering fluorescent lights reveal sticky notes plastered on every surface — hundreds of them, unestimated and unrefined. The air smells of stale coffee. You hear typing from the EAST. A supply closet is to the NORTH. The lobby is WEST.',
    exits: { east: 'tech_debt_cave', north: 'supply_closet', west: 'lobby' },
    enemies: ['zombie_ticket']
  },
  supply_closet: {
    id: 'supply_closet',
    name: 'The Supply Closet',
    description: 'A cramped closet filled with ancient sprint artifacts. Old burndown charts from 2019 hang on the walls. A dusty whiteboard marker set sits on a shelf. Among the clutter, you spot something useful.',
    exits: { south: 'dark_corridor' },
    items: ['whiteboard_marker', 'ancient_burndown_chart']
  },
  tech_debt_cave: {
    id: 'tech_debt_cave',
    name: 'The Tech Debt Cave',
    description: 'You enter a cavernous server room. Cables hang like vines from the ceiling. Legacy code scrolls across ancient monitors. A massive creature made entirely of TODO comments and deprecated functions lurks in the corner — THE TECH DEBT MONSTER. Exits lead WEST back to the corridor and SOUTH to the Testing Grounds.',
    exits: { west: 'dark_corridor', south: 'testing_grounds' },
    enemies: ['tech_debt_monster'],
    items: ['refactoring_sword']
  },
  testing_grounds: {
    id: 'testing_grounds',
    name: 'The Testing Grounds',
    description: 'A vast open space filled with test environments. Automated test suites run on screens everywhere — some green, some terrifyingly red. A QA engineer chicken in a lab coat mutters about edge cases. The path continues EAST to the CI/CD Pipeline. NORTH returns to the Tech Debt Cave.',
    exits: { north: 'tech_debt_cave', east: 'cicd_pipeline' },
    items: ['test_automation_shield'],
    special: 'qa_engineer'
  },
  cicd_pipeline: {
    id: 'cicd_pipeline',
    name: 'The CI/CD Pipeline',
    description: 'You stand inside a massive tube-like structure. Conveyor belts carry code packages from left to right through stages: BUILD → TEST → STAGE → DEPLOY. Some packages fall off and shatter. A control panel on the wall has a big red button labeled "DEPLOY TO PROD." The Testing Grounds are WEST. A ladder leads UP to the Scrum Floor.',
    exits: { west: 'testing_grounds', up: 'scrum_floor' },
    items: ['deployment_key'],
    special: 'pipeline'
  },
  scrum_floor: {
    id: 'scrum_floor',
    name: 'The Scrum Floor',
    description: 'The heart of Agile Tower. A massive physical Kanban board dominates the north wall — columns labeled TODO, IN PROGRESS, IN REVIEW, DONE. Sticky notes cover every inch. Team pods surround you. The Daily Standup Arena is NORTH. The Refinement Chamber is EAST. The Retrospective Room is WEST. An elevator goes DOWN.',
    exits: { north: 'standup_arena', east: 'refinement_chamber', west: 'retro_room', down: 'elevator_hall' },
    items: ['kanban_board_photo']
  },
  standup_arena: {
    id: 'standup_arena',
    name: 'The Daily Standup Arena',
    description: 'A circular arena with a 15-minute hourglass in the center. Chairs have been removed (as is tradition). A podium displays three sacred questions: "What did you do yesterday? What will you do today? Any blockers?" The Parking Lot board is on the east wall. The Scrum Floor is SOUTH.',
    exits: { south: 'scrum_floor', east: 'parking_lot' },
    special: 'standup',
    items: ['hourglass_of_timeboxing']
  },
  parking_lot: {
    id: 'parking_lot',
    name: 'The Parking Lot',
    description: 'Not an actual parking lot, but the sacred board where off-topic discussions are banished during standup. Dozens of sticky notes with tangential ideas are pinned here. One note catches your eye: "SECRET: The Scope Creep hides in the Backlog Basement." A door leads WEST back to the arena. Stairs go DOWN.',
    exits: { west: 'standup_arena', down: 'backlog_basement' }
  },
  backlog_basement: {
    id: 'backlog_basement',
    name: 'The Backlog Basement',
    description: 'Deep beneath Agile Tower lies the Backlog Basement — where user stories go to die. Thousands of unrefined tickets float in a murky pool. Some date back years. In the center, on a throne of rejected PRs, sits THE SCOPE CREEP — a menacing figure in a pinstripe suit with a monocle and an overflowing briefcase.',
    exits: { up: 'parking_lot', east: 'scope_creep_vault' },
    enemies: ['scope_creep'],
    locked: { east: { requires: 'definition_of_ready_scroll', message: 'The vault door has a riddle: "Only those who know what READY means may enter."' } }
  },
  scope_creep_vault: {
    id: 'scope_creep_vault',
    name: "The Scope Creep's Vault",
    description: 'Behind the defeated Scope Creep, you find his vault. Inside: mountains of gold-plated requirement documents, a collection of "urgent" labels, and... THE GOLDEN SPRINT TROPHY! It gleams with the light of a thousand successful deployments.',
    exits: { west: 'backlog_basement' },
    items: ['golden_sprint_trophy']
  },
  refinement_chamber: {
    id: 'refinement_chamber',
    name: 'The Refinement Chamber',
    description: 'A sacred chamber where raw ideas are forged into proper user stories. An ancient stone tablet on the wall reads the Definition of Ready. A wise owl (actually a chicken in an owl costume) offers guidance. The Estimation Dojo is NORTH. The Scrum Floor is WEST.',
    exits: { west: 'scrum_floor', north: 'estimation_dojo' },
    items: ['definition_of_ready_scroll'],
    special: 'refinement_owl'
  },
  estimation_dojo: {
    id: 'estimation_dojo',
    name: 'The Estimation Dojo',
    description: 'A zen garden where story pointing happens. Planning poker cards are scattered like fallen leaves. A sensei chicken in meditation pose floats above the ground. "Size matters not," he whispers. "Judge me by my story points, do you?" The Refinement Chamber is SOUTH. A hidden passage leads EAST.',
    exits: { south: 'refinement_chamber', east: 'velocity_vault' },
    items: ['planning_poker_cards'],
    special: 'estimation_sensei'
  },
  velocity_vault: {
    id: 'velocity_vault',
    name: 'The Velocity Vault',
    description: 'A secure room displaying sprint velocity charts across the ages. The numbers tell stories of triumph and disaster. A glass case holds the legendary "Consistent Velocity Crystal" — said to grant teams predictable delivery. A passage leads WEST to the Dojo and NORTH to the Sprint Review Theater.',
    exits: { west: 'estimation_dojo', north: 'sprint_review_theater' },
    items: ['velocity_crystal']
  },
  sprint_review_theater: {
    id: 'sprint_review_theater',
    name: 'The Sprint Review Theater',
    description: 'A grand theater with stadium seating. A stage at the front has a massive screen for demos. Stakeholder chickens sit in the audience, some sleeping, some on their phones. A sign reads "DEMO OR IT DIDN\'T HAPPEN." The Velocity Vault is SOUTH. A backstage door leads EAST to the Product Owner\'s Lair.',
    exits: { south: 'velocity_vault', east: 'po_lair' },
    special: 'demo'
  },
  po_lair: {
    id: 'po_lair',
    name: "The Product Owner's Lair",
    description: 'A corner office overflowing with roadmaps, customer feedback, and half-eaten sandwiches. The Product Owner chicken paces frantically, juggling priorities. A massive priority matrix covers one wall. "EVERYTHING is P1!" she squawks. The Sprint Review Theater is WEST. A secret elevator goes UP to the Executive Suite.',
    exits: { west: 'sprint_review_theater', up: 'executive_suite' },
    items: ['priority_matrix', 'csuite_badge'],
    special: 'product_owner'
  },
  retro_room: {
    id: 'retro_room',
    name: 'The Retrospective Room',
    description: 'A cozy room with beanbags, fairy lights, and a whiteboard divided into three columns: "Went Well 🌟", "Didn\'t Go Well 💀", "Improve 🚀". Previous retro notes still linger. A mysterious door to the NORTH is labeled "The Improvement Forge." The Scrum Floor is EAST.',
    exits: { east: 'scrum_floor', north: 'improvement_forge' },
    items: ['retro_sticky_notes'],
    special: 'retro'
  },
  improvement_forge: {
    id: 'improvement_forge',
    name: 'The Improvement Forge',
    description: 'A blazing forge where action items from retrospectives are hammered into real improvements. Many action items lie half-finished, abandoned after Sprint 1. A blacksmith chicken hammers away at a "Reduce Meeting Time" initiative. The Retro Room is SOUTH. A tunnel leads EAST to the Agile Coach\'s Tower.',
    exits: { south: 'retro_room', east: 'agile_coach_tower' },
    items: ['improvement_hammer']
  },
  agile_coach_tower: {
    id: 'agile_coach_tower',
    name: "The Agile Coach's Tower",
    description: 'A tall tower filled with books: "Scrum Guide," "The Phoenix Project," "Accelerate," "Team Topologies." An Agile Coach chicken sits cross-legged, surrounded by certification badges. "Ah, a seeker of the Golden Sprint," she says. "You will need the WIP Limit Shield to survive the DevOps Dungeon." The Improvement Forge is WEST.',
    exits: { west: 'improvement_forge' },
    items: ['wip_limit_shield'],
    special: 'agile_coach'
  },
  devops_dungeon: {
    id: 'devops_dungeon',
    name: 'The DevOps Dungeon',
    description: 'A dark, industrial space filled with server racks and blinking lights. The air hums with the sound of containers spinning up. Monitoring dashboards show RED alerts everywhere. A DevOps engineer chicken frantically types. "The pipeline is broken!" she cries. Paths lead NORTH to the Incident War Room and SOUTH to the Monitoring Maze. The elevator is WEST.',
    exits: { north: 'incident_room', south: 'monitoring_maze', west: 'elevator_hall' },
    enemies: ['broken_pipeline_golem']
  },
  incident_room: {
    id: 'incident_room',
    name: 'The Incident War Room',
    description: 'Alarms blare. Red lights flash. A massive screen shows "SEVERITY 1 - PRODUCTION DOWN." Chickens run in circles. Someone is writing a postmortem already. The chaos is overwhelming but there might be something useful here. The DevOps Dungeon is SOUTH.',
    exits: { south: 'devops_dungeon' },
    items: ['incident_response_playbook', 'coffee_of_infinite_energy']
  },
  monitoring_maze: {
    id: 'monitoring_maze',
    name: 'The Monitoring Maze',
    description: 'A labyrinth of Grafana dashboards, Datadog alerts, and PagerDuty notifications. Every wall is a screen showing metrics. CPU usage, memory, latency, error rates — the numbers swim before your eyes. A path EAST leads to the Deployment Gate. NORTH returns to the DevOps Dungeon.',
    exits: { north: 'devops_dungeon', east: 'deployment_gate' },
    special: 'monitoring'
  },
  deployment_gate: {
    id: 'deployment_gate',
    name: 'The Deployment Gate',
    description: 'A massive gate blocks your path. Above it: "ONLY TESTED, REVIEWED, AND APPROVED CODE MAY PASS." A guardian chicken in armor checks each deployment. The Monitoring Maze is WEST. Beyond the gate (EAST) lies the Production Paradise.',
    exits: { west: 'monitoring_maze', east: 'production_paradise' },
    locked: { east: { requires: 'deployment_key', message: 'The guardian blocks your path. "Where is your deployment key? No key, no deploy!"' } }
  },
  production_paradise: {
    id: 'production_paradise',
    name: 'Production Paradise',
    description: 'You emerge into a serene garden. Everything works perfectly here. Uptime is 99.99%. Users are happy. The sun shines. Birds sing. A golden path leads NORTH to the Executive Suite. This is what we fight for.',
    exits: { north: 'executive_suite', west: 'deployment_gate' }
  },
  executive_suite: {
    id: 'executive_suite',
    name: 'The Executive Suite',
    description: 'The top floor of Agile Tower. Panoramic windows show the city below. A long mahogany table seats important-looking chickens in suits. A CEO chicken looks up from a quarterly report. "Ah, you seek the Golden Sprint Trophy? It was stolen by the Scope Creep and hidden in the Backlog Basement. But beware — he is protected by bureaucracy." The elevator is SOUTH. Production Paradise is also accessible SOUTH.',
    exits: { south: 'elevator_hall', down: 'po_lair' },
    special: 'executive'
  },
  exit: {
    id: 'exit',
    name: 'Freedom!',
    description: 'You step out of Agile Tower, Golden Sprint Trophy in hand. The sun rises over the city. Your team awaits. The sprint is saved. YOU WIN!',
    exits: {},
    special: 'victory'
  }
};

const ITEMS_INFO: Record<string, { name: string; description: string }> = {
  visitor_badge: { name: 'Visitor Badge', description: 'A basic access badge. Gets you through most doors.' },
  whiteboard_marker: { name: 'Whiteboard Marker', description: 'A dry-erase marker. Mightier than the sword in Agile.' },
  ancient_burndown_chart: { name: 'Ancient Burndown Chart', description: 'A burndown chart from 2019. The line goes UP. Terrifying.' },
  refactoring_sword: { name: 'Refactoring Sword', description: 'A blade forged from clean code principles. Effective against Tech Debt.' },
  test_automation_shield: { name: 'Test Automation Shield', description: 'A shield that blocks regression bugs. +20 defense.' },
  deployment_key: { name: 'Deployment Key', description: 'A key that unlocks the Deployment Gate. Handle with care.' },
  kanban_board_photo: { name: 'Kanban Board Photo', description: 'A photo of the perfect Kanban board. Inspirational.' },
  hourglass_of_timeboxing: { name: 'Hourglass of Timeboxing', description: 'Keeps meetings to exactly 15 minutes. Magical.' },
  definition_of_ready_scroll: { name: 'Definition of Ready Scroll', description: 'The sacred scroll. The Scope Creep fears it above all else.' },
  planning_poker_cards: { name: 'Planning Poker Cards', description: 'Cards numbered 1, 2, 3, 5, 8, 13, 21. The Fibonacci sequence of estimation.' },
  velocity_crystal: { name: 'Velocity Crystal', description: 'Grants predictable delivery. Glows when velocity is stable.' },
  priority_matrix: { name: 'Priority Matrix', description: 'Shows what is truly important vs. what is merely urgent.' },
  csuite_badge: { name: 'C-Suite Access Badge', description: 'A platinum badge granting access to the Executive Suite elevator.' },
  retro_sticky_notes: { name: 'Retro Sticky Notes', description: 'Colorful notes filled with team wisdom and improvement ideas.' },
  improvement_hammer: { name: 'Improvement Hammer', description: 'Forged from action items actually completed. Rare and powerful.' },
  wip_limit_shield: { name: 'WIP Limit Shield', description: 'Prevents taking on too much work. Essential for flow.' },
  incident_response_playbook: { name: 'Incident Response Playbook', description: 'Step-by-step guide for when everything is on fire.' },
  coffee_of_infinite_energy: { name: 'Coffee of Infinite Energy', description: 'Restores full health. Tastes like a 3am deploy.' },
  golden_sprint_trophy: { name: 'Golden Sprint Trophy', description: 'THE GOLDEN SPRINT TROPHY! The ultimate prize. Your quest is complete!' }
};

const ENEMY_INFO: Record<string, { name: string; description: string; health: number; attack: string; weakness: string }> = {
  zombie_ticket: { name: 'Zombie Ticket', description: 'An undead JIRA ticket from Sprint -5. It refuses to die.', health: 20, attack: 'haunts you with unresolved comments', weakness: 'whiteboard_marker' },
  tech_debt_monster: { name: 'Tech Debt Monster', description: 'A massive creature made of TODO comments, deprecated functions, and copy-pasted code.', health: 50, attack: 'crushes you with legacy dependencies', weakness: 'refactoring_sword' },
  scope_creep: { name: 'The Scope Creep', description: 'A villain in a pinstripe suit. Monocle gleaming. Briefcase overflowing with "just one more feature" requests.', health: 80, attack: 'overwhelms you with new requirements', weakness: 'definition_of_ready_scroll' },
  broken_pipeline_golem: { name: 'Broken Pipeline Golem', description: 'A construct of failed builds and merge conflicts. It blocks all progress.', health: 40, attack: 'throws build errors at you', weakness: 'test_automation_shield' }
};

function Game() {
  const [gameState, setGameState] = useState<GameState>({
    currentRoom: 'lobby',
    inventory: [],
    visited: ['lobby'],
    flags: {},
    health: 100,
    score: 0,
    moves: 0
  });
  const [output, setOutput] = useState<string[]>([
    '╔══════════════════════════════════════════════════════════╗',
    '║   THE QUEST FOR THE GOLDEN SPRINT                       ║',
    '║   A Zork-Style Agile Text Adventure                     ║',
    '║   Release Train Chronicles © 2024                       ║',
    '╚══════════════════════════════════════════════════════════╝',
    '',
    'Type HELP for a list of commands.',
    '',
    '---',
    ''
  ]);
  const [input, setInput] = useState('');
  const [gameOver, setGameOver] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Show initial room description
    const room = ROOMS[gameState.currentRoom];
    setOutput(prev => [...prev, `> ${room.name}`, room.description, '']);
  }, []);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const addOutput = useCallback((lines: string[]) => {
    setOutput(prev => [...prev, ...lines]);
  }, []);

  const processCommand = useCallback((cmd: string) => {
    if (gameOver || gameWon) {
      if (cmd.toLowerCase() === 'restart') {
        window.location.reload();
        return;
      }
      addOutput(['Game is over. Type RESTART to play again.', '']);
      return;
    }

    const parts = cmd.toLowerCase().trim().split(/\s+/);
    const verb = parts[0];
    const noun = parts.slice(1).join('_');

    setGameState(prev => {
      const state = { ...prev, moves: prev.moves + 1 };
      const room = ROOMS[state.currentRoom];
      const lines: string[] = [];

      switch (verb) {
        case 'help':
        case 'h':
          lines.push(
            'COMMANDS:',
            '  LOOK (L)          - Examine your surroundings',
            '  GO <direction>    - Move (NORTH/SOUTH/EAST/WEST/UP/DOWN or N/S/E/W/U/D)',
            '  TAKE <item>       - Pick up an item',
            '  USE <item>        - Use an item',
            '  INVENTORY (I)     - Check your inventory',
            '  EXAMINE <item>    - Look at an item closely',
            '  ATTACK            - Attack an enemy (if present)',
            '  TALK              - Talk to an NPC (if present)',
            '  SCORE             - Check your score',
            '  HEALTH            - Check your health',
            '  MAP               - Show visited rooms',
            '  RESTART           - Start over',
            '  QUIT              - End game',
            ''
          );
          break;

        case 'look':
        case 'l':
          lines.push(`> ${room.name}`, room.description);
          if (room.items && room.items.length > 0) {
            const availableItems = room.items.filter(i => !state.inventory.includes(i) && !state.flags[`taken_${i}`]);
            if (availableItems.length > 0) {
              lines.push(`\nYou see: ${availableItems.map(i => ITEMS_INFO[i]?.name || i).join(', ')}`);
            }
          }
          if (room.enemies && room.enemies.length > 0) {
            const aliveEnemies = room.enemies.filter(e => !state.flags[`defeated_${e}`]);
            if (aliveEnemies.length > 0) {
              lines.push(`\n⚠️  DANGER: ${aliveEnemies.map(e => ENEMY_INFO[e]?.name || e).join(', ')} blocks your path!`);
            }
          }
          lines.push('');
          break;

        case 'go':
        case 'north': case 'south': case 'east': case 'west': case 'up': case 'down':
        case 'n': case 's': case 'e': case 'w': case 'u': case 'd': {
          let direction = noun;
          if (['north', 'south', 'east', 'west', 'up', 'down'].includes(verb)) direction = verb;
          if (verb === 'n') direction = 'north';
          if (verb === 's') direction = 'south';
          if (verb === 'e') direction = 'east';
          if (verb === 'w') direction = 'west';
          if (verb === 'u') direction = 'up';
          if (verb === 'd') direction = 'down';

          if (!direction) {
            lines.push('Go where? (north/south/east/west/up/down)', '');
            break;
          }

          // Check if enemies block the path
          if (room.enemies) {
            const aliveEnemies = room.enemies.filter(e => !state.flags[`defeated_${e}`]);
            if (aliveEnemies.length > 0 && direction !== Object.keys(room.exits).find(k => room.exits[k] === prev.currentRoom)) {
              lines.push(`The ${ENEMY_INFO[aliveEnemies[0]]?.name || 'enemy'} blocks your path! You must defeat it first.`, '');
              break;
            }
          }

          if (!room.exits[direction]) {
            lines.push('You cannot go that way.', '');
            break;
          }

          // Check if locked
          if (room.locked && room.locked[direction]) {
            const lock = room.locked[direction];
            if (!state.inventory.includes(lock.requires) && !state.flags[`unlocked_${room.id}_${direction}`]) {
              lines.push(lock.message, '');
              break;
            }
          }

          const nextRoomId = room.exits[direction];
          const nextRoom = ROOMS[nextRoomId];
          state.currentRoom = nextRoomId;
          if (!state.visited.includes(nextRoomId)) {
            state.visited = [...state.visited, nextRoomId];
            state.score += 5;
          }

          lines.push(`\nYou go ${direction}.\n`);
          lines.push(`> ${nextRoom.name}`, nextRoom.description);

          if (nextRoom.items) {
            const availableItems = nextRoom.items.filter(i => !state.inventory.includes(i) && !state.flags[`taken_${i}`]);
            if (availableItems.length > 0) {
              lines.push(`\nYou see: ${availableItems.map(i => ITEMS_INFO[i]?.name || i).join(', ')}`);
            }
          }
          if (nextRoom.enemies) {
            const aliveEnemies = nextRoom.enemies.filter(e => !state.flags[`defeated_${e}`]);
            if (aliveEnemies.length > 0) {
              lines.push(`\n⚠️  DANGER: ${aliveEnemies.map(e => ENEMY_INFO[e]?.name || e).join(', ')} is here!`);
            }
          }

          if (nextRoom.special === 'victory') {
            state.score += 100;
            lines.push('\n🏆 CONGRATULATIONS! YOU HAVE WON! 🏆');
            lines.push(`Final Score: ${state.score} | Moves: ${state.moves}`);
            lines.push('The Golden Sprint Trophy is yours. Your team celebrates.');
            lines.push('Type RESTART to play again.');
            setTimeout(() => setGameWon(true), 0);
          }

          lines.push('');
          break;
        }

        case 'take':
        case 'get':
        case 'pick': {
          if (!noun) {
            lines.push('Take what?', '');
            break;
          }
          const matchedItem = room.items?.find(i => i.includes(noun) || ITEMS_INFO[i]?.name.toLowerCase().includes(parts.slice(1).join(' ')));
          if (!matchedItem) {
            lines.push("You don't see that here.", '');
            break;
          }
          if (state.inventory.includes(matchedItem) || state.flags[`taken_${matchedItem}`]) {
            lines.push("You've already taken that.", '');
            break;
          }
          state.inventory = [...state.inventory, matchedItem];
          state.flags = { ...state.flags, [`taken_${matchedItem}`]: true };
          state.score += 10;
          lines.push(`You pick up the ${ITEMS_INFO[matchedItem]?.name || matchedItem}.`, '');
          break;
        }

        case 'inventory':
        case 'i': {
          if (state.inventory.length === 0) {
            lines.push('Your inventory is empty.', '');
          } else {
            lines.push('INVENTORY:');
            state.inventory.forEach(item => {
              lines.push(`  • ${ITEMS_INFO[item]?.name || item}`);
            });
            lines.push('');
          }
          break;
        }

        case 'examine':
        case 'x': {
          if (!noun) {
            lines.push('Examine what?', '');
            break;
          }
          const examItem = state.inventory.find(i => i.includes(noun) || ITEMS_INFO[i]?.name.toLowerCase().includes(parts.slice(1).join(' ')));
          if (examItem) {
            lines.push(`${ITEMS_INFO[examItem]?.name}: ${ITEMS_INFO[examItem]?.description}`, '');
          } else {
            lines.push("You don't have that item.", '');
          }
          break;
        }

        case 'use': {
          if (!noun) {
            lines.push('Use what?', '');
            break;
          }
          const useItem = state.inventory.find(i => i.includes(noun) || ITEMS_INFO[i]?.name.toLowerCase().includes(parts.slice(1).join(' ')));
          if (!useItem) {
            lines.push("You don't have that.", '');
            break;
          }
          if (useItem === 'coffee_of_infinite_energy') {
            state.health = 100;
            state.inventory = state.inventory.filter(i => i !== useItem);
            lines.push('You drink the Coffee of Infinite Energy. Health fully restored! ☕', '');
          } else if (useItem === 'hourglass_of_timeboxing') {
            lines.push('You flip the hourglass. Time feels more... bounded. Meetings everywhere shorten.', '');
            state.score += 5;
          } else {
            lines.push(`You hold up the ${ITEMS_INFO[useItem]?.name}. It might be useful against the right enemy.`, '');
          }
          break;
        }

        case 'attack':
        case 'fight': {
          if (!room.enemies) {
            lines.push('There is nothing to attack here.', '');
            break;
          }
          const aliveEnemies = room.enemies.filter(e => !state.flags[`defeated_${e}`]);
          if (aliveEnemies.length === 0) {
            lines.push('All enemies here have been defeated.', '');
            break;
          }
          const enemy = aliveEnemies[0];
          const enemyInfo = ENEMY_INFO[enemy];
          const hasWeakness = state.inventory.includes(enemyInfo.weakness);

          if (hasWeakness) {
            state.flags = { ...state.flags, [`defeated_${enemy}`]: true };
            state.score += 25;
            lines.push(`You wield the ${ITEMS_INFO[enemyInfo.weakness]?.name}!`);
            lines.push(`The ${enemyInfo.name} ${enemy === 'scope_creep' ? 'recoils in horror! "NO! Not the Definition of Ready!"' : 'crumbles before your might!'}`);
            lines.push(`\n✨ ${enemyInfo.name} DEFEATED! +25 points`, '');
          } else {
            state.health -= 20;
            lines.push(`You attack the ${enemyInfo.name} but without the right weapon, it ${enemyInfo.attack}!`);
            lines.push(`You take 20 damage! Health: ${state.health}/100`);
            if (state.health <= 0) {
              lines.push('\n💀 YOU HAVE BEEN DEFEATED! 💀');
              lines.push(`The ${enemyInfo.name} was too powerful without its weakness.`);
              lines.push(`Hint: You needed the ${ITEMS_INFO[enemyInfo.weakness]?.name}.`);
              lines.push('Type RESTART to try again.');
              setTimeout(() => setGameOver(true), 0);
            } else {
              lines.push(`Hint: This enemy has a weakness. Find the right item!`);
            }
            lines.push('');
          }
          break;
        }

        case 'talk': {
          if (room.special === 'qa_engineer') {
            lines.push('QA Engineer: "Always test in production... I mean, NEVER test in production! Here, take this shield. It blocks regression bugs."', '');
          } else if (room.special === 'refinement_owl') {
            lines.push('Refinement Owl: "Hoo-hoo! A story must have acceptance criteria, be estimated, and be small enough to complete in one sprint. Take this scroll — it contains the sacred Definition of Ready."', '');
          } else if (room.special === 'estimation_sensei') {
            lines.push('Estimation Sensei: "A 13-point story, you say? Break it down, you must. If explain it simply you cannot, understand it well enough you do not."', '');
          } else if (room.special === 'agile_coach') {
            lines.push('Agile Coach: "The WIP Limit Shield will protect you in the DevOps Dungeon. Remember: stop starting, start finishing. Limit your work in progress and flow will follow."', '');
          } else if (room.special === 'product_owner') {
            lines.push('Product Owner: "Everything is priority 1! Well... okay, maybe not EVERYTHING. Take this C-Suite badge — you will need it to reach the executives. And this priority matrix might help you see what truly matters."', '');
          } else if (room.special === 'executive') {
            lines.push('CEO: "The Golden Sprint Trophy was stolen by the Scope Creep. He lurks in the Backlog Basement, deep below the Parking Lot. You will need the Definition of Ready Scroll to enter his vault. Good luck, and remember — deliver value, not features."', '');
          } else {
            lines.push('There is no one here to talk to.', '');
          }
          break;
        }

        case 'score':
          lines.push(`Score: ${state.score} | Moves: ${state.moves} | Rooms visited: ${state.visited.length}/${Object.keys(ROOMS).length}`, '');
          break;

        case 'health':
        case 'hp':
          lines.push(`Health: ${state.health}/100`, '');
          break;

        case 'map': {
          lines.push('VISITED ROOMS:');
          state.visited.forEach(roomId => {
            const r = ROOMS[roomId];
            const marker = roomId === state.currentRoom ? ' ← YOU ARE HERE' : '';
            lines.push(`  ${r.name}${marker}`);
          });
          lines.push(`\n${state.visited.length}/${Object.keys(ROOMS).length} rooms discovered.`, '');
          break;
        }

        case 'quit':
          lines.push('Thanks for playing The Quest for the Golden Sprint!', `Final Score: ${state.score} | Moves: ${state.moves}`, '');
          setTimeout(() => setGameOver(true), 0);
          break;

        case 'restart':
          window.location.reload();
          break;

        default:
          lines.push("I don't understand that command. Type HELP for a list of commands.", '');
      }

      addOutput(lines);
      return state;
    });
  }, [gameOver, gameWon, addOutput]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    addOutput([`\n$ ${input}`]);
    processCommand(input);
    setInput('');
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4" onClick={() => inputRef.current?.focus()}>
      <div className="w-full max-w-4xl">
        {/* CRT Monitor Frame */}
        <div className="border-4 border-gray-700 rounded-lg bg-black shadow-[0_0_60px_rgba(0,255,0,0.1)] overflow-hidden">
          {/* Scanline overlay */}
          <div className="relative">
            <div className="absolute inset-0 pointer-events-none z-10 opacity-10"
              style={{
                background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)'
              }}
            />
            {/* Terminal Output */}
            <div
              ref={outputRef}
              className="h-[70vh] overflow-y-auto p-6 font-mono text-sm leading-relaxed"
              style={{
                color: '#00ff41',
                textShadow: '0 0 5px rgba(0,255,65,0.5)',
                scrollbarWidth: 'thin',
                scrollbarColor: '#00ff41 #000'
              }}
            >
              {output.map((line, i) => (
                <div key={i} className={line === '---' ? 'border-b border-green-900 my-2' : 'min-h-[1.2em]'}>
                  {line === '---' ? '' : line}
                </div>
              ))}
            </div>
            {/* Input */}
            <form onSubmit={handleSubmit} className="border-t border-green-900 p-4 flex items-center gap-2">
              <span className="font-mono text-green-400" style={{ textShadow: '0 0 5px rgba(0,255,65,0.5)' }}>{'>'}</span>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none font-mono text-sm"
                style={{
                  color: '#00ff41',
                  textShadow: '0 0 5px rgba(0,255,65,0.5)',
                  caretColor: '#00ff41'
                }}
                placeholder="Enter command..."
                autoFocus
                disabled={gameOver || gameWon}
              />
            </form>
          </div>
        </div>
        {/* Status Bar */}
        <div className="mt-2 flex justify-between font-mono text-xs" style={{ color: '#00ff41', opacity: 0.7 }}>
          <span>HP: {gameState.health}/100</span>
          <span>Score: {gameState.score}</span>
          <span>Moves: {gameState.moves}</span>
          <span>Items: {gameState.inventory.length}</span>
          <span>Rooms: {gameState.visited.length}/{Object.keys(ROOMS).length}</span>
        </div>
      </div>
    </div>
  );
}

export default Game;
