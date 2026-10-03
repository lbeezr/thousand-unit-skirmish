#!/usr/bin/env python3
"""Private offline comparison. Uses repository originals; makes no game changes.
Cue oscillators are analytic approximations, not a browser/Web Audio capture.
Requires ffmpeg, Python numpy/scipy/matplotlib already present on this host.
"""
import argparse, hashlib, json, math, os, pathlib, subprocess
import numpy as np
from scipy.signal import butter, sosfilt
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--repository',type=pathlib.Path,default=pathlib.Path.cwd())
parser.add_argument('--output',type=pathlib.Path,required=True)
args=parser.parse_args()
ROOT=args.repository.resolve()
OUT=args.output.resolve()
OUT.mkdir(parents=True,exist_ok=True)
os.environ['MPLCONFIGDIR']=str(OUT/'matplotlib-config')
os.environ['XDG_CACHE_HOME']=str(OUT/'xdg-cache')
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
RATE=48000
DURATION=64
MIX={'overall':.25,'effects':1,'voice':1,'music':.5,'ambience':.4}
BUS={'master':.25*.78,'effects':.52,'music':.5*.55,'ambience':.4*.18}
CAT=json.loads((ROOT/'assets/audio/vaelora-zones-v1/catalog.json').read_text())
records={s['id']:s for s in CAT['sources']}
sources={}
source_metrics={}
def db(x): return float(20*np.log10(max(float(x),1e-12)))
def rms(x): return float(np.sqrt(np.mean(np.asarray(x,dtype=np.float64)**2)))
def decode(identifier):
    record=records[identifier]
    path=ROOT/'assets/audio/vaelora-zones-v1'/record['file']
    digest=hashlib.sha256(path.read_bytes()).hexdigest()
    assert digest==record['sha256'],f'source hash mismatch: {identifier}'
    raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-f','f32le','-acodec','pcm_f32le','-ar',str(RATE),'-ac','2','pipe:1'])
    samples=np.frombuffer(raw,dtype='<f4').reshape(-1,2).copy()
    assert np.isfinite(samples).all()
    source_metrics[identifier]={'path':str(path.relative_to(ROOT)),'sha256':digest,'catalogDurationSeconds':record['actualDurationSeconds'],'decodedSeconds':len(samples)/RATE,'decodedRate':RATE,'channels':2,'rmsDbfs':db(rms(samples)),'peakDbfs':db(np.max(np.abs(samples))),'rawEofWrapMaxStepDbfs':db(np.max(np.abs(samples[-1]-samples[0])))}
    return samples
for pair in ['siltmouths','bellweather']:
    for family in ['music','contrast']: sources[f'{pair}-{family}']=decode(f'{pair}-{family}')

def sequence(samples,period,gain):
    output=np.zeros((DURATION*RATE,2),np.float32)
    length=round(period*RATE)
    assert length<=len(samples)
    t=np.arange(length)/RATE
    envelope=np.minimum(np.minimum(t/2,(period-t)/3),1).clip(0,1)
    cycle=(samples[:length]*envelope[:,None]*gain).astype(np.float32)
    for i in range(math.ceil(DURATION/period)):
        start=round(i*period*RATE)
        stop=min(len(output),start+length)
        if stop>start: output[start:stop]+=cycle[:stop-start]
    return output,cycle

def cue(kind):
    spec={'gather-work':(420,550,.07,.14),'move':(310,390,.09,.19),'resource-empty':(415.3,311.13,.11,.11)}
    start,end,duration,gain=spec[kind]
    t=np.arange(round((duration+.01)*RATE))/RATE
    k=np.log(end/start)/duration
    phase=2*np.pi*start*np.expm1(k*t)/k
    result=np.zeros(len(t))
    # Triangle Fourier series; odd harmonics stop below Nyquist at maximum sweep Hz.
    for n in range(1,int((RATE/2)/max(start*np.exp(k*(duration+.01)),end,start))+1,2):
        result+=((-1)**((n-1)//2))*np.sin(n*phase)/(n*n)
    result*=8/(np.pi*np.pi)
    attack=min(.018,duration*.25)
    envelope=np.where(t<=attack,.0001*np.exp(np.log(gain/.0001)*t/attack),gain*np.exp(np.log(.0001/gain)*(t-attack)/(duration-attack)))
    envelope[t>duration]=.0001
    mono=(result*envelope*BUS['master']*BUS['effects']).astype(np.float32)
    return np.repeat(mono[:,None],2,axis=1),round(duration*RATE)
CUES={k:cue(k) for k in ['gather-work','move','resource-empty']}
filter_sos=butter(6,[300,700],btype='bandpass',fs=RATE,output='sos')

def ratio_metrics(background,kind,period):
    sound,active_frames=CUES[kind]
    active=sound[:active_frames]
    band_background=sosfilt(filter_sos,background,axis=0)
    band_cue=sosfilt(filter_sos,sound,axis=0)[:active_frames]
    cue_rms=rms(active); cue_band_rms=rms(band_cue)
    windows=[]
    # Fully settled first-cycle windows; fade-in/out and a single selected phrase cannot bias this probe.
    for at in np.arange(2,period-3-active_frames/RATE,.25):
        a=round(at*RATE); b=a+active_frames
        windows.append({'atSeconds':round(float(at),3),'broadbandCueMinusBackgroundDb':db(cue_rms)-db(rms(background[a:b])),'band300to700CueMinusBackgroundDb':db(cue_band_rms)-db(rms(band_background[a:b]))})
    def summary(field):
        values=np.array([w[field] for w in windows])
        return {k:round(float(v),3) for k,v in {'minimum':values.min(),'p10':np.percentile(values,10),'median':np.median(values),'p90':np.percentile(values,90),'maximum':values.max()}.items()}
    return {'activeSeconds':active_frames/RATE,'cueRmsDbfs':db(cue_rms),'probeWindows':len(windows),'samplingIntervalSeconds':.25,'coverage':'Discrete cue-length windows, not continuous sliding minima','broadband':summary('broadbandCueMinusBackgroundDb'),'band300to700':summary('band300to700CueMinusBackgroundDb'),'worstBroadbandAtSeconds':min(windows,key=lambda w:w['broadbandCueMinusBackgroundDb'])['atSeconds'],'windows':windows}

def seam_metrics(output,cycle,period):
    seam=round(period*RATE)
    stable=rms(output[2*RATE:round((period-3)*RATE)])
    return {'periodSeconds':period,'fadedCutWrapMaxStepDbfs':db(np.max(np.abs(cycle[-1]-cycle[0]))),'renderedBoundaryMaxStepDbfs':db(np.max(np.abs(output[seam]-output[seam-1]))),'stableRmsDbfs':db(stable),'boundary100msRmsDbfs':db(rms(output[seam-round(.05*RATE):seam+round(.05*RATE)])),'boundary100msMinusStableDb':db(rms(output[seam-round(.05*RATE):seam+round(.05*RATE)]))-db(stable),'boundary1sMinusStableDb':db(rms(output[seam-round(.5*RATE):seam+round(.5*RATE)]))-db(stable)}
pairs={}; rendered={}; telemetry={}
for pair in ['siltmouths','bellweather']:
    manifest=json.loads((ROOT/f'assets/audio/runtime/vaelora-{pair}/v2/manifest.json').read_text())
    music_comp=next(c for c in manifest['pack']['compositions'] if c['id']=='everyday')
    environment_comp=next(c for c in manifest['pack']['compositions'] if c['id']=='environment')
    periods={k:c['lengthBars']*c['beatsPerBar']*60/c['bpm'] for k,c in [('music',music_comp),('contrast',environment_comp)]}
    stems={};cycles={}
    for family,composition,bus in [('music',music_comp,'music'),('contrast',environment_comp,'ambience')]:
        track=composition['tracks'][0]; clip=track['clips'][0]
        assert track['gain']==(.35 if family=='music' else .6)
        assert clip['fadeInSeconds']==2 and clip['fadeOutSeconds']==3 and clip['offsetSeconds']==0
        gain=BUS['master']*BUS[bus]*track['gain']*clip['gain']
        stems[family],cycles[family]=sequence(sources[f'{pair}-{family}'],periods[family],gain)
        source_metrics[f'{pair}-{family}']['runtimeCutSeconds']=periods[family]
        cut=round(periods[family]*RATE)
        source_metrics[f'{pair}-{family}']['unfadedRuntimeCutWrapMaxStepDbfs']=db(np.max(np.abs(sources[f'{pair}-{family}'][cut-1]-sources[f'{pair}-{family}'][0])))
    normal=stems['music']+stems['contrast']; reduced=stems['music']*.5+stems['contrast']
    assert np.max(np.abs(normal))<1
    rendered[pair]=normal
    pairs[pair]={'rmsDbfs':db(rms(normal)),'peakDbfs':db(np.max(np.abs(normal))),'clippedSamples':int(np.sum(np.abs(normal)>=1)),'musicPeriodSeconds':periods['music'],'waterBedPeriodSeconds':periods['contrast'],'musicSeam':seam_metrics(stems['music'],cycles['music'],periods['music']),'waterBedSeam':seam_metrics(stems['contrast'],cycles['contrast'],periods['contrast']),'normalMixCues':{kind:ratio_metrics(normal,kind,periods['music']) for kind in CUES},'music25PercentCues':{kind:ratio_metrics(reduced,kind,periods['music']) for kind in CUES}}
    # Use 100 ms power, never a waveform or RMS curve as proof of perceived loudness.
    block=round(.1*RATE); telemetry[pair]=np.sqrt(np.mean(normal[:len(normal)//block*block].reshape(-1,block,2).astype(np.float64)**2,axis=(1,2)))

# Same source timeline and identical cue schedule for each normal-mix passage.
events=[(3,'gather-work'),(4.5,'gather-work'),(6,'gather-work'),(7.5,'move'),(9,'gather-work'),(10.5,'gather-work'),(12,'resource-empty')]
parts=[];timeline=[];elapsed=0
for pair in ['siltmouths','bellweather']:
    passage=rendered[pair][4*RATE:18*RATE].copy()
    for at,kind in events:
        sound,_=CUES[kind]; start=round((at+.005)*RATE);passage[start:start+len(sound)]+=sound
    timeline.append({'startSeconds':elapsed,'endSeconds':elapsed+14,'pair':pair,'segment':'normal-mix source time 4–18 s','cues':[{'atSeconds':elapsed+at+.005,'cue':kind} for at,kind in events]})
    parts.extend([passage,np.zeros((RATE,2),np.float32)]);elapsed+=15
for pair in ['siltmouths','bellweather']:
    boundary=round(pairs[pair]['musicPeriodSeconds']*RATE)
    passage=rendered[pair][boundary-4*RATE:boundary+4*RATE].copy()
    timeline.append({'startSeconds':elapsed,'endSeconds':elapsed+8,'pair':pair,'segment':'current-fade loop boundary','boundarySeconds':elapsed+4})
    parts.extend([passage,np.zeros((RATE,2),np.float32)]);elapsed+=9
comparison=np.concatenate(parts)
assert len(comparison)==48*RATE and np.isfinite(comparison).all() and np.max(np.abs(comparison))<1
path=OUT/'shore-fishing-siltmouths-then-bellweather-normal-mix.wav'
subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar',str(RATE),'-ac','2','-i','pipe:0','-c:a','pcm_s24le',str(path)],input=comparison.astype('<f4').tobytes(),check=True)
# The published/private comparison stays at the game gains; no loudness normalization/limiter.
metrics={'schemaVersion':1,'date':'2026-10-03','revision':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'method':'FFmpeg decoded source PCM at 48 kHz stereo, exact steady-state current bus/track gains; independent composition cycles with 2 s linear entrance and 3 s exit fades; analytically reconstructed triangle cues with current exponential frequency/envelope; no Web Audio capture or hearing','execution':{'python':__import__('platform').python_version(),'numpy':np.__version__,'scipy':__import__('scipy').__version__,'matplotlib':matplotlib.__version__,'ffmpeg':subprocess.check_output(['ffmpeg','-version'],text=True).splitlines()[0]},'mix':MIX,'busGains':BUS,'modeledRelativeStartOffsetSeconds':0,'actualRelativeStartupPhaseCaptured':False,'sources':source_metrics,'pairs':pairs,'privateComparison':{'fileName':path.name,'durationSeconds':48,'rate':RATE,'channels':2,'pcmBits':24,'peakDbfs':db(np.max(np.abs(comparison))),'clippedSamples':int(np.sum(np.abs(comparison)>=1)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'timeline':timeline},'limits':['No auditory input support: audio tool returned content omitted; neither candidate has been heard here.','RMS/300–700 Hz energy ratios are interference indicators, not psychoacoustic masking or recognition scores.','Analytic cue approximation differs from Web Audio oscillator implementation and omits startup smoothing/hardware output.','Modeled clip fades produce a substantial level valley; no seamless-crossfade or heard-seam acceptance is established.','Both independent players start at modeled time zero. Actual runtime starts follow independent/sequential async decode and were not captured; combined valley timing and first-cycle ratios assume that relative phase.','Water contrast replaces the current terrain source only in this private render; no map/default/profile edit.','Existing source authorization/provenance reused; no new provider call, rights grant or public audio distribution.']}
(OUT/'shore-fishing-measurements.json').write_text(json.dumps(metrics,indent=2)+'\n')
compact=__import__('copy').deepcopy(metrics)
for pair in compact['pairs'].values():
    for level in ['normalMixCues','music25PercentCues']:
        for measured in pair[level].values(): measured.pop('windows',None)
(OUT/'shore-fishing-summary.json').write_text(json.dumps(compact,indent=2)+'\n')
fig,axs=plt.subplots(2,1,figsize=(10,7),constrained_layout=True)
for pair in pairs:
    at=np.arange(len(telemetry[pair]))*.1+.05
    axs[0].plot(at,20*np.log10(np.maximum(telemetry[pair],1e-12)),label=pair)
axs[0].set(xlim=(24,35),ylim=(-110,-35),xlabel='Source timeline (seconds)',ylabel='100 ms RMS (dBFS)',title='Current 2 s / 3 s fades around the first loop boundary (measured)');axs[0].legend();axs[0].grid(alpha=.3)
positions=np.arange(3)
for i,pair in enumerate(pairs):
    vals=[pairs[pair]['normalMixCues'][kind]['band300to700'] for kind in CUES]
    med=np.array([v['median'] for v in vals]);lower=np.array([v['minimum'] for v in vals]);upper=np.array([v['maximum'] for v in vals])
    axs[1].errorbar(positions+(-.12 if i==0 else .12),med,yerr=np.stack([med-lower,upper-med]),fmt='o',capsize=5,label=pair)
axs[1].axhline(0,color='gray',ls=':');axs[1].set(xticks=positions,xticklabels=list(CUES),ylabel='Cue minus background (dB)',title='300–700 Hz: cue-length windows sampled every 250 ms (discrete range)');axs[1].legend();axs[1].grid(alpha=.3)
fig.savefig(OUT/'shore-fishing-measurements.png',dpi=140)
summary={pair:{'peakDbfs':v['peakDbfs'],'musicSeamDrop1sDb':v['musicSeam']['boundary1sMinusStableDb'],'bedSeamDrop1sDb':v['waterBedSeam']['boundary1sMinusStableDb'],'cues':{k:{'broadband':x['broadband'],'band300to700':x['band300to700'],'music25Band':v['music25PercentCues'][k]['band300to700']} for k,x in v['normalMixCues'].items()}} for pair,v in pairs.items()}
print(json.dumps({'revision':metrics['revision'],'sources':source_metrics,'summary':summary,'comparison':metrics['privateComparison']},indent=2))
