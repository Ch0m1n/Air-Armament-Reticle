import fs from 'node:fs';
import path from 'node:path';
// Invented values for regression tests, not data for any real ship or aircraft.
export function writeFixtureDataset(root,game='KORABLI',version='fixture-A') {
  const base=path.join(root,'GAME',game,version);
  for(const folder of ['Ships','Aircraft','Projectiles'])fs.mkdirSync(path.join(base,folder),{recursive:true});
  const aircraft={typeinfo:{type:'Aircraft'},outerSalvoSize:[2,4],innerSalvoSize:[1,2],minSpread:[1,1],maxSpread:[2,2],innerBombsPercentage:50,speedMoveWithBomb:100,attackCount:1,attackInterval:0.1,attackerSize:2,projectilesPerAttack:1,throttleAcceleration:0.1,throttleDeceleration:0,speedMin:0.8,speedMax:1.25,flightHeight:10};
  const bomb={...aircraft,name:'TEST_BOMBER',bombName:'TEST_BOMB'};
  const torpedo={name:'TEST_TORPEDO_STOCK',typeinfo:{type:'Aircraft'},torpedoName:'TEST_TORPEDO',minSpread:10,maxSpread:100,torpedoAimDist:50,attackerSize:2,projectilesPerAttack:1,attackCount:1,formations:{attack:[null,[[-2,0,0],[2,0,0]]]}};
  const researched={...torpedo,name:'TEST_TORPEDO_TOP',minSpread:8};
  const airstrike={...aircraft,name:'TEST_AIRSTRIKE',isAirSupportPlane:true,bombName:'TEST_BOMB',attackCount:3};
  const ship={name:'TST001_Synthetic_Carrier',typeinfo:{type:'Ship',nation:'TestNation',species:'AirCarrier'},level:1,
    A1_DiveBomber:{planes:[bomb.name]},A1_TorpedoBomber:{planes:[torpedo.name]},A2_TorpedoBomber:{planes:[researched.name]},
    A_AirSupport:{planeName:airstrike.name,minDist:100,maxDist:1000,useFixedTimeToAttackPoint:true,minTimeToAttackPoint:1,maxTimeToAttackPoint:4,maxTimeToAttackPointDistance:1000},
    ShipUpgradeInfo:{TEST_TB_STOCK:{components:{torpedoBomber:['A1_TorpedoBomber']},prev:''},TEST_TB_TOP:{components:{torpedoBomber:['A2_TorpedoBomber']},prev:'TEST_TB_STOCK'}}};
  const projectiles=[{name:'TEST_BOMB',typeinfo:{type:'Projectile'},ammoType:'HE',withParachute:true,fallTime:2},{name:'TEST_TORPEDO',typeinfo:{type:'Projectile'},ammoType:'torpedo',speed:20,armingTime:2,maxDist:100}];
  const write=(folder,value)=>fs.writeFileSync(path.join(base,folder,value.name+'.json'),JSON.stringify(value)+'\n');
  write('Ships',ship);for(const plane of [bomb,torpedo,researched,airstrike])write('Aircraft',plane);for(const weapon of projectiles)write('Projectiles',weapon);
  fs.writeFileSync(path.join(base,'dataset.json'),JSON.stringify({dataset:'Synthetic test fixture',snapshot:null,default:game==='KORABLI',defaults:[bomb,researched,airstrike].map(plane=>'TST001--'+plane.name)})+'\n');
}
