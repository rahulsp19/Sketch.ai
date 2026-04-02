export class CityGenerator {
  constructor(config = {}) {
    this.width = 12;
    this.height = 8;
    this.waterMeta = null;
    this.grid = Array.from({ length: this.height }, () => 
      Array.from({ length: this.width }, () => 'empty')
    );
    this.config = {
      waterStyle: config.waterStyle || 'none',
      primaryZone: config.primaryZone || 'commercial',
      density: config.density || 'medium',
      parkStyle: config.parkStyle || 'scattered',
      roadStyle: config.roadStyle || 'grid',
      forestDensity: config.forestDensity || 'normal',
      riverScale: config.riverScale || 'normal'
    };
  }

  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  setTileIfNotWater(x, y, type) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    if (this.grid[y][x] !== 'water') this.grid[y][x] = type;
  }

  isEdge(x, y) {
    return x === 0 || y === 0 || x === this.width - 1 || y === this.height - 1;
  }

  getCardinalNeighbors(x, y) {
    const dirs = [[-1,0], [1,0], [0,-1], [0,1]];
    const neighbors = [];
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
        neighbors.push({ x: nx, y: ny, type: this.grid[ny][nx] });
      }
    }
    return neighbors;
  }

  generate() {
    this.addWater();
    this.buildRoads();
    this.addStrategicRiverCrossings();
    this.ensureRoadConnectivity();
    this.addCoreZoning();
    this.addParks();
    this.fillResidential();
    this.enforceZoningRules();
    
    // Calculate elevation map (distance from water)
    const elevation = Array.from({ length: this.height }, () => Array(this.width).fill(0));
    const queue = [];
    
    // Initialize queue with water tiles (elevation 0)
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.grid[y][x] === 'water') {
          elevation[y][x] = 0;
          queue.push({ x, y, dist: 0 });
        } else {
          elevation[y][x] = Infinity;
        }
      }
    }
    
    // If no water, start from the edges
    if (queue.length === 0) {
       for (let y = 0; y < this.height; y++) {
         for (let x = 0; x < this.width; x++) {
           if (this.isEdge(x, y)) {
             elevation[y][x] = 0;
             queue.push({ x, y, dist: 0 });
           }
         }
       }
    }

    // BFS to calculate distance
    const dirs = [[-1,0], [1,0], [0,-1], [0,1]];
    while (queue.length > 0) {
      const { x, y, dist } = queue.shift();
      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
          if (elevation[ny][nx] > dist + 1) {
            elevation[ny][nx] = dist + 1;
            queue.push({ x: nx, y: ny, dist: dist + 1 });
          }
        }
      }
    }

    // Convert string array to Array<{x, y, type, elevation}> strictly matching the frontend expectations
    const finalGrid = [];
    for (let y = 0; y < this.height; y++) {
      const row = [];
      for (let x = 0; x < this.width; x++) {
        // Flatten the elevation slightly to make hills look good (step of 0.2 height per distance)
        let cellElevation = elevation[y][x] * 0.15;
        
        // Roads and bridges should be flat or flatten out the terrain.
        if (this.grid[y][x] === 'road') {
           // Average with neighbors or just keep it low
           cellElevation = Math.max(0.05, cellElevation * 0.5);
        } else if (this.grid[y][x] === 'water') {
           cellElevation = 0;
        } else {
           // Add a slight random noise to natural tiles
           cellElevation += (Math.random() * 0.05);
        }

        row.push({ x, y, type: this.grid[y][x], elevation: cellElevation });
      }
      finalGrid.push(row);
    }
    return finalGrid;
  }

  addWater() {
    const riverWidth = this.config.riverScale === 'wide' ? 3 : 1;
    this.waterMeta = null;

    if (this.config.waterStyle === 'river_vertical') {
      const center = Math.floor(this.width / 2) - Math.floor(riverWidth / 2);
      const startCol = this.clamp(center + (Math.floor(Math.random() * 3) - 1), 1, this.width - riverWidth - 1);
      this.waterMeta = { type: 'river_vertical', startCol, width: riverWidth };
      for (let y = 0; y < this.height; y++) {
        for (let w = 0; w < riverWidth; w++) {
          this.grid[y][startCol + w] = 'water';
        }
      }
    } else if (this.config.waterStyle === 'river_horizontal') {
      const center = Math.floor(this.height / 2) - Math.floor(riverWidth / 2);
      const startRow = this.clamp(center + (Math.floor(Math.random() * 3) - 1), 1, this.height - riverWidth - 1);
      this.waterMeta = { type: 'river_horizontal', startRow, width: riverWidth };
      for (let x = 0; x < this.width; x++) {
        for (let w = 0; w < riverWidth; w++) {
          this.grid[startRow + w][x] = 'water';
        }
      }
    } else if (this.config.waterStyle === 'coastal_left') {
      for (let y = 0; y < this.height; y++) { this.grid[y][0] = 'water'; this.grid[y][1] = 'water'; }
    } else if (this.config.waterStyle === 'coastal_right') {
      for (let y = 0; y < this.height; y++) { this.grid[y][this.width-1] = 'water'; this.grid[y][this.width-2] = 'water'; }
    } else if (this.config.waterStyle === 'lake_center') {
      const cx = Math.floor(this.width/2);
      const cy = Math.floor(this.height/2);
      this.grid[cy-1][cx-1] = 'water'; this.grid[cy-1][cx] = 'water';
      this.grid[cy][cx-1] = 'water'; this.grid[cy][cx] = 'water';
    }
  }

  addStrategicRiverCrossings() {
    if (!this.waterMeta) return;

    const bridgeCount = this.config.density === 'high' ? 2 : 1;
    if (this.waterMeta.type === 'river_vertical') {
      const rows = [Math.floor(this.height / 2)];
      if (bridgeCount > 1) rows.push(this.clamp(Math.floor(this.height * 0.25), 1, this.height - 2));

      for (const y of [...new Set(rows)]) {
        for (let w = 0; w < this.waterMeta.width; w++) {
          this.grid[y][this.waterMeta.startCol + w] = 'road';
        }
        this.setTileIfNotWater(this.waterMeta.startCol - 1, y, 'road');
        this.setTileIfNotWater(this.waterMeta.startCol + this.waterMeta.width, y, 'road');
      }
    }

    if (this.waterMeta.type === 'river_horizontal') {
      const cols = [Math.floor(this.width / 2)];
      if (bridgeCount > 1) cols.push(this.clamp(Math.floor(this.width * 0.25), 1, this.width - 2));

      for (const x of [...new Set(cols)]) {
        for (let w = 0; w < this.waterMeta.width; w++) {
          this.grid[this.waterMeta.startRow + w][x] = 'road';
        }
        this.setTileIfNotWater(x, this.waterMeta.startRow - 1, 'road');
        this.setTileIfNotWater(x, this.waterMeta.startRow + this.waterMeta.width, 'road');
      }
    }
  }

  getRoadComponents() {
    const seen = Array.from({ length: this.height }, () => Array(this.width).fill(false));
    const components = [];

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (seen[y][x] || this.grid[y][x] !== 'road') continue;
        const queue = [{ x, y }];
        const component = [];
        seen[y][x] = true;

        while (queue.length > 0) {
          const current = queue.pop();
          component.push(current);

          for (const neighbor of this.getCardinalNeighbors(current.x, current.y)) {
            if (seen[neighbor.y][neighbor.x] || this.grid[neighbor.y][neighbor.x] !== 'road') continue;
            seen[neighbor.y][neighbor.x] = true;
            queue.push({ x: neighbor.x, y: neighbor.y });
          }
        }

        components.push(component);
      }
    }

    return components;
  }

  carveRoadPath(fromX, fromY, toX, toY) {
    let x = fromX;
    let y = fromY;
    const horizontalFirst = Math.random() < 0.5;

    const stepHorizontal = () => {
      while (x !== toX) {
        x += toX > x ? 1 : -1;
        this.grid[y][x] = 'road';
      }
    };

    const stepVertical = () => {
      while (y !== toY) {
        y += toY > y ? 1 : -1;
        this.grid[y][x] = 'road';
      }
    };

    if (horizontalFirst) {
      stepHorizontal();
      stepVertical();
    } else {
      stepVertical();
      stepHorizontal();
    }
  }

  ensureRoadConnectivity() {
    let components = this.getRoadComponents();
    let guard = 0;

    while (components.length > 1 && guard < 24) {
      components.sort((a, b) => b.length - a.length);
      const base = components[0];
      let best = null;

      for (let i = 1; i < components.length; i++) {
        const candidate = components[i];
        for (const a of base) {
          for (const b of candidate) {
            const dist = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
            if (!best || dist < best.dist) {
              best = { dist, ax: a.x, ay: a.y, bx: b.x, by: b.y };
            }
          }
        }
      }

      if (!best) break;
      this.carveRoadPath(best.ax, best.ay, best.bx, best.by);
      components = this.getRoadComponents();
      guard++;
    }
  }

  buildRoads() {
    if (this.config.roadStyle === 'grid') {
      // 1 horizontal main artery, 1 vertical main artery
      const hSpine = Math.floor(this.height / 2); 
      const vSpine = Math.floor(this.width / 2);
      
      for (let x = 0; x < this.width; x++) if (this.grid[hSpine][x] !== 'water') this.grid[hSpine][x] = 'road';
      for (let y = 0; y < this.height; y++) if (this.grid[y][vSpine] !== 'water') this.grid[y][vSpine] = 'road';
      
      // Additional sub-arteries for high density
      if (this.config.density === 'high') {
         const hSpine2 = this.height - 2;
         const vSpine2 = Math.floor(this.width / 4);
         const vSpine3 = Math.floor((this.width / 4) * 3);
         
         for (let x = 0; x < this.width; x++) if (this.grid[hSpine2][x] !== 'water') this.grid[hSpine2][x] = 'road';
         for (let y = 0; y < this.height; y++) {
             if (this.grid[y][vSpine2] !== 'water') this.grid[y][vSpine2] = 'road';
             if (this.grid[y][vSpine3] !== 'water') this.grid[y][vSpine3] = 'road';
         }
      }
    } else {
      // Organic: create meandering corridors instead of rigid loops.
      const cx = Math.floor(this.width / 2);
      const cy = Math.floor(this.height / 2);
      const verticalAmplitude = this.config.density === 'high' ? 2 : 1;
      const horizontalAmplitude = this.config.density === 'high' ? 2 : 1;

      for (let y = 0; y < this.height; y++) {
        const wave = Math.round(Math.sin((y + 1) * 0.9) * verticalAmplitude);
        const x = this.clamp(cx + wave, 1, this.width - 2);
        this.setTileIfNotWater(x, y, 'road');
        if (this.config.density === 'high') this.setTileIfNotWater(x + 1, y, 'road');
      }

      for (let x = 0; x < this.width; x++) {
        const wave = Math.round(Math.cos((x + 2) * 0.7) * horizontalAmplitude);
        const y = this.clamp(cy + wave, 1, this.height - 2);
        this.setTileIfNotWater(x, y, 'road');
      }

      if (this.config.density !== 'low') {
        const branchBase = this.clamp(cy + 2, 1, this.height - 2);
        for (let x = 0; x < this.width; x++) {
          const y = this.clamp(branchBase + Math.round(Math.sin(x * 0.8)), 1, this.height - 2);
          this.setTileIfNotWater(x, y, 'road');
        }
      }
    }
  }

  addCoreZoning() {
    let coreCount = this.config.density === 'high' ? 14 : this.config.density === 'medium' ? 8 : 4;

    if (this.config.primaryZone === 'industrial') {
      this.addIndustrialCore(coreCount);
      return;
    }
    
    // Attempt to cluster along intersections or geographic center
    const cx = Math.floor(this.width/2);
    const cy = Math.floor(this.height/2);
    
    for(let radius = 1; radius < 6 && coreCount > 0; radius++) {
      for(let y = cy-radius; y <= cy+radius && coreCount > 0; y++) {
        for(let x = cx-radius; x <= cx+radius && coreCount > 0; x++) {
          if (y >= 0 && y < this.height && x >= 0 && x < this.width) {
            if (this.grid[y][x] === 'empty') {
               // Only zone if adjacent to a road to guarantee walkability
               if (this.isAdjacentTo(x, y, 'road') || this.isAdjacentTo(x, y, this.config.primaryZone)) {
                 this.grid[y][x] = this.config.primaryZone;
                 coreCount--;
               }
            }
          }
        }
      }
    }
  }

  addIndustrialCore(coreCount) {
    const cx = Math.floor(this.width / 2);
    const cy = Math.floor(this.height / 2);
    const candidates = [];

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.grid[y][x] !== 'empty') continue;

        const centerDist = Math.abs(x - cx) + Math.abs(y - cy);
        let score = 0;
        if (this.isEdge(x, y)) score += 4;
        if (this.isAdjacentTo(x, y, 'road')) score += 3;
        if (this.isAdjacentTo(x, y, 'water')) score += 3;
        if (centerDist >= 4) score += 1;
        if (this.isAdjacentTo(x, y, 'residential')) score -= 5;

        candidates.push({ x, y, score: score + Math.random() * 0.4 });
      }
    }

    candidates.sort((a, b) => b.score - a.score);

    for (const c of candidates) {
      if (coreCount <= 0) break;
      if (this.grid[c.y][c.x] !== 'empty') continue;
      this.grid[c.y][c.x] = 'industrial';
      coreCount--;
    }
  }

  addParks() {
    if (this.config.forestDensity === 'high') {
      this.addDenseForests();
      return;
    }

    let parkCount = this.config.parkStyle === 'central' ? 6 : this.config.parkStyle === 'bordering' ? 12 : this.config.parkStyle === 'scattered' ? 8 : 0;
    
    if (this.config.parkStyle === 'central') {
      const cx = 3, cy = Math.floor(this.height/2);
      for(let y=cy-1; y<=cy+1; y++) {
        for(let x=cx-1; x<=cx+1; x++) {
          if (this.grid[y]?.[x] === 'empty' && parkCount > 0) { this.grid[y][x] = 'park'; parkCount--; }
        }
      }
    } else if (this.config.parkStyle === 'bordering') {
      // Line the outside edges
      for(let x=0; x<this.width && parkCount > 0; x++) {
        if(this.grid[0][x] === 'empty') { this.grid[0][x] = 'park'; parkCount--; }
        if(this.grid[this.height-1][x] === 'empty') { this.grid[this.height-1][x] = 'park'; parkCount--; }
      }
    } else if (this.config.parkStyle === 'scattered') {
      for(let y=0; y<this.height && parkCount > 0; y++) {
        for(let x=0; x<this.width && parkCount > 0; x++) {
          if (this.grid[y][x] === 'empty' && Math.random() < 0.2) {
            this.grid[y][x] = 'park';
            parkCount--;
          }
        }
      }
    }
  }

  addDenseForests() {
    const targetParks = Math.floor(this.width * this.height * 0.38);
    let parksPlaced = 0;
    let attempts = 0;

    while (parksPlaced < targetParks && attempts < 3000) {
      attempts++;
      const x = Math.floor(Math.random() * this.width);
      const y = Math.floor(Math.random() * this.height);

      if (this.grid[y][x] !== 'empty') continue;

      const nearForest = this.isAdjacentTo(x, y, 'park');
      const nearRoad = this.isAdjacentTo(x, y, 'road');
      const placementChance = nearForest ? 0.8 : nearRoad ? 0.35 : 0.55;

      if (Math.random() < placementChance) {
        this.grid[y][x] = 'park';
        parksPlaced++;
      }
    }
  }

  fillResidential() {
    // Fill all remaining empty space with residential (suburbs)
    // High density = fill 100%, low density = fill 40%
    let fillRate = this.config.density === 'high' ? 1.0 : this.config.density === 'medium' ? 0.8 : 0.4;
    if (this.config.forestDensity === 'high') fillRate *= 0.85;
    let residentialCount = 0;
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.grid[y][x] === 'residential') {
          residentialCount++;
          continue;
        }

        if (this.grid[y][x] === 'empty') {
          const nearRoad = this.isAdjacentTo(x, y, 'road');
          const nearResidential = this.isAdjacentTo(x, y, 'residential');
          const nearIndustrial = this.isAdjacentTo(x, y, 'industrial');
          let chance = nearRoad ? fillRate : nearResidential ? fillRate * 0.7 : fillRate * 0.12;
          if (nearIndustrial) chance *= 0.08;
          if (Math.random() < chance) {
             this.grid[y][x] = 'residential';
             residentialCount++;
          }
        }
      }
    }

    this.ensureMinimumResidential(residentialCount);
  }

  getMinimumResidential() {
    if (this.config.forestDensity === 'high') {
      return this.config.density === 'low' ? 8 : this.config.density === 'medium' ? 14 : 20;
    }
    return this.config.density === 'low' ? 12 : this.config.density === 'medium' ? 20 : 30;
  }

  ensureMinimumResidential(currentCount = 0) {
    let residentialCount = currentCount;
    if (residentialCount === 0) {
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          if (this.grid[y][x] === 'residential') residentialCount++;
        }
      }
    }

    // Keep a minimum amount of housing so low-density maps still feel inhabited.
    const minResidential = this.getMinimumResidential();

    if (residentialCount >= minResidential) return;

    for (let y = 0; y < this.height && residentialCount < minResidential; y++) {
      for (let x = 0; x < this.width && residentialCount < minResidential; x++) {
        if (
          this.grid[y][x] === 'empty' &&
          this.isAdjacentTo(x, y, 'road') &&
          !this.isAdjacentTo(x, y, 'industrial')
        ) {
          this.grid[y][x] = 'residential';
          residentialCount++;
        }
      }
    }

    for (let y = 0; y < this.height && residentialCount < minResidential; y++) {
      for (let x = 0; x < this.width && residentialCount < minResidential; x++) {
        if (this.grid[y][x] === 'empty' && !this.isAdjacentTo(x, y, 'industrial')) {
          this.grid[y][x] = 'residential';
          residentialCount++;
        }
      }
    }

    for (let y = 0; y < this.height && residentialCount < minResidential; y++) {
      for (let x = 0; x < this.width && residentialCount < minResidential; x++) {
        if (this.grid[y][x] === 'empty') {
          this.grid[y][x] = 'residential';
          residentialCount++;
        }
      }
    }
  }

  findNearestRoad(x, y) {
    let best = null;
    for (let yy = 0; yy < this.height; yy++) {
      for (let xx = 0; xx < this.width; xx++) {
        if (this.grid[yy][xx] !== 'road') continue;
        const dist = Math.abs(xx - x) + Math.abs(yy - y);
        if (!best || dist < best.dist) best = { x: xx, y: yy, dist };
      }
    }
    return best;
  }

  enforceZoningRules() {
    const conversions = [];

    // Keep a small buffer between industry and housing.
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.grid[y][x] !== 'residential') continue;
        if (!this.isAdjacentTo(x, y, 'industrial')) continue;

        const replacement = 'park';
        conversions.push({ x, y, replacement });
      }
    }

    for (const c of conversions) {
      if (this.grid[c.y][c.x] === 'water') continue;
      this.grid[c.y][c.x] = c.replacement;
    }

    // Ensure industrial zones always have a road path.
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.grid[y][x] !== 'industrial') continue;
        if (this.isAdjacentTo(x, y, 'road')) continue;

        const nearestRoad = this.findNearestRoad(x, y);
        if (nearestRoad) {
          this.carveRoadPath(x, y, nearestRoad.x, nearestRoad.y);
        }
      }
    }

    this.ensureRoadConnectivity();
    this.ensureMinimumResidential();
  }

  isAdjacentTo(x, y, type) {
    const dirs = [[-1,0], [1,0], [0,-1], [0,1]];
    for (let [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
        if (this.grid[ny][nx] === type) return true;
      }
    }
    return false;
  }
}
