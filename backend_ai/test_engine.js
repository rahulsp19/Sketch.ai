const prompts = [
  "A dense coastal city with towering commercial skyscrapers and modern high-tech layout.",
  "A large industrial logging operation bordering a vertical river. Low density housing.",
  "A massive residential suburb surrounding a beautiful central lake."
];

async function runCriticalTest() {
  console.log("=== INITIATING CRITICAL ENGINE AUDIT ===");
  for (let i = 0; i < prompts.length; i++) {
    console.log(`\nTEST #${i+1}: "${prompts[i]}"`);
    
    try {
      const start = Date.now();
      const res = await fetch('http://localhost:3001/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompts[i] })
      });
      
      if (!res.ok) {
        console.log(`❌ HTTP Error: ${res.status}`);
        console.log(await res.text());
        continue;
      }
      
      const payload = await res.json();
      const grid = payload.layoutData;
      
      console.log(`✅ Server Responded in ${Date.now() - start}ms`);
      
      // 1. Grid Size Test
      let totalCells = 0;
      let is8x12 = grid.length === 8 && grid.every(row => row.length === 12);
      grid.forEach(r => totalCells += r.length);
      console.log(`[DIMENSION TEST]: ${is8x12 ? 'PASS (8x12)' : `FAIL - Total Cells: ${totalCells}`}`);
      
      // 2. Road Graph Test (No isolated nodes)
      let isolatedRoads = 0;
      let totalRoads = 0;
      const getAt = (x, y) => grid[y]?.[x]?.type;
      
      grid.forEach((row, y) => {
        row.forEach((cell, x) => {
          if (cell.type === 'road') {
            totalRoads++;
            let neighbors = [getAt(x-1,y), getAt(x+1,y), getAt(x,y-1), getAt(x,y+1)];
            if (!neighbors.includes('road')) isolatedRoads++;
          }
        });
      });
      console.log(`[ROAD GRAPH TEST]: ${isolatedRoads === 0 ? 'PASS' : `FAIL - ${isolatedRoads} isolated roads`}`);
      
      // 3. Zone Distribution
      let counts = {};
      grid.flat().forEach(c => counts[c.type] = (counts[c.type] || 0) + 1);
      console.log(`[DISTRIBUTION]: `, counts);
      
    } catch(e) {
      console.error("❌ Exception: ", e.message);
    }
  }
}

runCriticalTest();
