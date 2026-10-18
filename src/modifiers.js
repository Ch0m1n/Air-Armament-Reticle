const modifierDefinitions={
  bomb:[['outerSalvoSize','Outer salvo size','raw',0.0001,10000],['innerSalvoSize','Inner salvo size','raw',0.0001,10000],['minSpread','Minimum spread','raw',0.0001,10000],['maxSpread','Maximum spread','raw',0.0001,10000],['innerBombsPercentage','Inner allocation','%',0,100],['speedMoveWithBomb','Release speed','kn',0,1000],['attackCount','Releases','count',1,50,true],['attackInterval','Release interval','s',0,120]],
  airstrike:[['outerSalvoSize','Outer salvo size','raw',0.0001,10000],['innerSalvoSize','Inner salvo size','raw',0.0001,10000],['minSpread','Minimum spread','raw',0.0001,10000],['innerBombsPercentage','Inner allocation','%',0,100],['speedMoveWithBomb','Release speed','kn',0.0001,1000],['speedMax','Maximum speed multiplier','ratio',1,10],['throttleAcceleration','Throttle acceleration','raw',0,100],['throttleDeceleration','Throttle deceleration','raw',0,100],['flightHeight','Flight height','raw',0,10000],['attackerSize','Attacking aircraft','count',1,50,true],['projectilesPerAttack','Payload per release','count',1,50,true],['attackCount','Releases','count',1,50,true],['attackInterval','Release interval','s',0,120]],
  torpedo:[['minSpread','Minimum spread','raw',0,10000],['maxSpread','Maximum spread','raw',0,10000],['torpedoAimDist','Aim distance','raw',0.0001,10000],['projectilesPerAttack','Payload per release','count',1,50,true],['attackCount','Releases','count',1,50,true],['maxDist','Torpedo range','raw × 30 m',0.0001,10000,false,'projectile'],['speed','Torpedo speed','kn',0.0001,1000,false,'projectile'],['armingTime','Arming time','s',0,120,false,'projectile']]
};
function modifierFields(kind,plane,weapon) {
  return (modifierDefinitions[kind]||[]).flatMap(([key,label,unit,min,max,integer,target='aircraft'])=>{
    const value=(target==='aircraft'?plane:weapon)?.[key];
    if(typeof value==='number'&&Number.isFinite(value))return [{key,label,unit,min,max,integer:!!integer,target,value}];
    if(Array.isArray(value)&&value.length===2&&value.every(Number.isFinite))return value.map((n,index)=>({key,index,label:label+(index===0?' X':' Y'),unit,min,max,integer:false,target,value:n}));
    return [];
  });
}
function modifierKey(field){return field.target+':'+field.key+(field.index==null?'':':'+field.index);}
function modifierHelp(kind,field) {
  const axis=field.index===0?'width':'length';
  if(field.key==='outerSalvoSize')return `Base ${axis} of the outer bomb region in raw game units, not meters. ${kind==='airstrike'?'Combined with minimum spread and release travel to estimate the overall drop envelope.':'Combined with the spread ratio and release travel to estimate the maximum aiming outline.'}`;
  if(field.key==='innerSalvoSize')return `Base ${axis} of the inner bomb distribution region, in raw game units. This is not the minimum aiming outline or a ship hit probability.`;
  if(field.key==='minSpread')return kind==='torpedo'?'Estimated fully aimed sector width at torpedoAimDist, in raw units (30 m each). The sector interpolates from formation width to this width, rather than using it as an angle.':kind==='airstrike'?`Scales the ${axis} of each bomb release region. The full envelope also includes travel between releases.`:`Used relative to maximum spread to scale the fully aimed ${axis} of both the outer and inner regions.`;
  if(field.key==='maxSpread')return kind==='torpedo'?'Upper spread bound. The current torpedo illustration does not draw a separate maximum-aim fan.':field.index===0?'Horizontal spread reference. Used in the ellipse aspect ratio and the fully aimed width scale; this is not a width in meters.':'Longitudinal spread reference. Used in the ellipse aspect ratio and the fully aimed length scale; this is not a length in meters.';
  const descriptions={
    innerBombsPercentage:'Percentage allocated to the inner distribution region in the estimate. This is not the chance to hit a ship. Airstrike previews use this allocation to sample illustrative drops.',
    speedMoveWithBomb:kind==='airstrike'?'Aircraft speed during release, in knots. Changes estimated travel between releases and, for non-fixed approaches, estimated flight time.':'Aircraft speed during release, in knots. Adds longitudinal travel to the bomber ellipse when there is more than one release.',
    speedMax:'Speed cap multiplier used when throttle acceleration is positive. Affects release travel and non-fixed approach timing in the current airstrike estimate.',
    throttleAcceleration:'When positive, selects the maximum-speed cap for airstrike geometry. Its magnitude affects acceleration during non-fixed approach timing.',
    throttleDeceleration:'Used for geometry only when acceleration is zero. Braking-only approach timing is not supported; changing this may make flight-time estimates unavailable.',
    flightHeight:'Height input used for non-parachute bomb fall-time estimates. Does not change the drawn drop area. Parachute bombs use projectile fall time instead.',
    attackerSize:'Number of attacking aircraft. Multiplies the airstrike payload and illustrative drop count; does not change the estimated envelope dimensions.',
    projectilesPerAttack:kind==='torpedo'?'Torpedoes per aircraft per release. Changes the total payload and schematic drop markers, not a verified torpedo spacing.':'Bombs per aircraft per release. Multiplies the airstrike payload and illustrative drop count; does not widen the envelope.',
    attackCount:kind==='torpedo'?'Number of releases. Multiplies the reported torpedo total. Travel between multiple torpedo releases is not drawn.':kind==='airstrike'?'Number of releases. Multiplies total bombs and extends the drop envelope by travel between releases.':'Number of releases. Adds longitudinal travel to the bomber ellipse when greater than one.',
    attackInterval:'Time between releases, in seconds. Changes longitudinal travel when there are multiple releases. Airstrike previews also use it to sequence their drop markers.',
    torpedoAimDist:'Distance at which minimum spread specifies the fully aimed sector width, in raw units (30 m each). Changes the estimated sector slope; not torpedo maximum range.',
    maxDist:'Projectile range in raw game units. The current estimate converts this to meters by multiplying by 30. Changes the torpedo range axis, not its exact horizontal spread.',
    speed:'Projectile speed in knots. Combined with arming time to estimate arming distance; does not change range unless the range field is also edited.',
    armingTime:'Time before a torpedo arms, in seconds. Combined with projectile speed to estimate arming distance. A longer time moves the armed boundary farther from release.'
  };
  return descriptions[field.key]||'';
}
function modifiedInputs(kind,plane,weapon,overrides={}) {
  if(!overrides||typeof overrides!=='object'||Array.isArray(overrides))throw Error('Invalid modifiers');
  const fields=modifierFields(kind,plane,weapon),allowed=new Map(fields.map(field=>[modifierKey(field),field]));
  const aircraft=structuredClone(plane),projectile=structuredClone(weapon),normalized={};
  for(const [key,value]of Object.entries(overrides)) {
    const field=allowed.get(key);
    if(!field)throw Error('Unsupported modifier: '+key);
    if(typeof value!=='number'||!Number.isFinite(value)||value<field.min||value>field.max||field.integer&&!Number.isInteger(value))throw Error('Invalid value: '+field.label);
    if(value===field.value)continue;
    const target=field.target==='aircraft'?aircraft:projectile;
    if(field.index==null)target[field.key]=value;else target[field.key][field.index]=value;
    normalized[key]=value;
  }
  if(kind==='bomb'&&Array.isArray(aircraft.minSpread)&&aircraft.minSpread.some((n,i)=>n>aircraft.maxSpread[i]))throw Error('Minimum spread must not exceed maximum spread');
  if(kind==='torpedo'&&aircraft.minSpread>aircraft.maxSpread)throw Error('Minimum spread must not exceed maximum spread');
  const payload=aircraft.attackerSize*aircraft.projectilesPerAttack*aircraft.attackCount;
  if(kind==='airstrike'&&(!Number.isFinite(payload)||payload>4096||aircraft.attackerSize*aircraft.projectilesPerAttack>128))throw Error('Airstrike payload exceeds the supported limit');
  return {aircraft,projectile,overrides:normalized};
}
