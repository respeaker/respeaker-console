// Frontend parameter catalog.
//
// Mirrors `src-tauri/src/xvf/parameters.rs` exactly so the UI can render
// forms, validate ranges, and group parameters by resource without needing a
// round-trip to the backend. In a connected Tauri build we also reconcile
// with `xvf_list_commands` on startup to catch drift during development.

import type { ParameterAccess, ParameterInfo, ParameterKind } from "./types";

type Def = [string, number, number, number, ParameterAccess, ParameterKind, string];

const DEFS: Def[] = [
  // APPLICATION_SERVICER_RESID (48)
  ["VERSION", 48, 0, 3, "ro", "uint8", "Firmware version MAJOR.MINOR.PATCH"],
  ["BLD_MSG", 48, 1, 50, "ro", "char", "Firmware build message"],
  ["BLD_HOST", 48, 2, 30, "ro", "char", "CI build host details"],
  ["BLD_REPO_HASH", 48, 3, 40, "ro", "char", "GIT hash of the sw_xvf3800 repo"],
  ["BLD_MODIFIED", 48, 4, 6, "ro", "char", "Whether the firmware repo was modified"],
  ["BOOT_STATUS", 48, 5, 3, "ro", "char", "Boot mode: SPI or JTAG/FLASH"],
  ["TEST_CORE_BURN", 48, 6, 1, "rw", "uint8", "Enable core burn (internal testing only)"],
  ["REBOOT", 48, 7, 1, "wo", "uint8", "Set to any value to reboot the chip"],
  ["USB_BIT_DEPTH", 48, 8, 2, "rw", "uint8", "USB bit depth (UA variant only)"],
  ["SAVE_CONFIGURATION", 48, 9, 1, "wo", "uint8", "Save current configuration to flash"],
  ["CLEAR_CONFIGURATION", 48, 10, 1, "wo", "uint8", "Clear configuration and revert to defaults"],

  // AEC_RESID (33)
  ["SHF_BYPASS", 33, 70, 1, "rw", "uint8", "AEC bypass"],
  ["AEC_NUM_MICS", 33, 71, 1, "ro", "int32", "Number of microphone inputs into the AEC"],
  ["AEC_NUM_FARENDS", 33, 72, 1, "ro", "int32", "Number of farend inputs into the AEC"],
  [
    "AEC_MIC_ARRAY_TYPE",
    33,
    73,
    1,
    "ro",
    "int32",
    "Microphone array type (1=linear, 2=squarecular)",
  ],
  ["AEC_MIC_ARRAY_GEO", 33, 74, 12, "ro", "float", "Microphone array geometry (XYZ per mic)"],
  [
    "AEC_AZIMUTH_VALUES",
    33,
    75,
    4,
    "ro",
    "radians",
    "Azimuth per beam: 0=beam1, 1=beam2, 2=free, 3=auto",
  ],
  [
    "AEC_CURRENT_IDLE_TIME",
    33,
    77,
    1,
    "ro",
    "uint32",
    "AEC processing current idle time (10ns ticks)",
  ],
  ["AEC_MIN_IDLE_TIME", 33, 78, 1, "ro", "uint32", "AEC processing minimum idle time (10ns ticks)"],
  ["AEC_RESET_MIN_IDLE_TIME", 33, 79, 1, "wo", "uint32", "Reset the AEC minimum idle time"],
  ["AEC_SPENERGY_VALUES", 33, 80, 4, "ro", "float", "Speech energy level per beam"],
  [
    "AEC_FIXEDBEAMSAZIMUTH_VALUES",
    33,
    81,
    2,
    "rw",
    "radians",
    "Azimuth values for fixed-mode beams",
  ],
  ["AEC_FIXEDBEAMSELEVATION_VALUES", 33, 82, 2, "rw", "radians", "Elevation for fixed-mode beams"],
  [
    "AEC_FIXEDBEAMSGATING",
    33,
    83,
    1,
    "rw",
    "uint8",
    "Enable/disable gating for beams in fixed mode",
  ],
  ["AEC_AECPATHCHANGE", 33, 0, 1, "ro", "int32", "AEC Path Change Detection (0/1)"],
  ["AEC_HPFONOFF", 33, 1, 1, "rw", "int32", "High-pass filter on microphone signals (0..4)"],
  ["AEC_AECSILENCELEVEL", 33, 2, 2, "rw", "float", "Power threshold for signal detection"],
  ["AEC_AECCONVERGED", 33, 3, 1, "ro", "int32", "Whether AEC is converged (0/1)"],
  ["AEC_AECEMPHASISONOFF", 33, 4, 1, "rw", "int32", "Pre/de-emphasis filter for AEC (0/1/2)"],
  ["AEC_FAR_EXTGAIN", 33, 5, 1, "rw", "float", "External gain (dB) applied to far-end signals"],
  ["AEC_PCD_COUPLINGI", 33, 6, 1, "rw", "float", "PCD sensitivity [0.0..1.0]"],
  ["AEC_PCD_MINTHR", 33, 7, 1, "rw", "float", "PCD minimum threshold"],
  ["AEC_PCD_MAXTHR", 33, 8, 1, "rw", "float", "PCD maximum threshold"],
  ["AEC_RT60", 33, 9, 1, "ro", "float", "Current RT60 estimate in seconds"],
  ["AEC_ASROUTONOFF", 33, 35, 1, "rw", "int32", "Automatic speech recognition output (0/1)"],
  ["AEC_ASROUTGAIN", 33, 36, 1, "rw", "float", "Fixed gain applied to ASR output"],
  ["AEC_FIXEDBEAMSONOFF", 33, 37, 1, "rw", "int32", "Enable fixed focused beam mode (0/1)"],
  [
    "AEC_FIXEDBEAMNOISETHR",
    33,
    38,
    2,
    "rw",
    "float",
    "Noise canceller threshold in fixed beam mode",
  ],

  // AUDIO_MGR_RESID (35)
  ["AUDIO_MGR_MIC_GAIN", 35, 0, 1, "rw", "float", "Pre-SHF microphone gain"],
  ["AUDIO_MGR_REF_GAIN", 35, 1, 1, "rw", "float", "Pre-SHF reference gain"],
  ["AUDIO_MGR_CURRENT_IDLE_TIME", 35, 2, 1, "ro", "int32", "Audio manager current idle time"],
  ["AUDIO_MGR_MIN_IDLE_TIME", 35, 3, 1, "ro", "int32", "Audio manager min idle time"],
  ["AUDIO_MGR_RESET_MIN_IDLE_TIME", 35, 4, 1, "wo", "int32", "Reset audio manager min idle time"],
  ["MAX_CONTROL_TIME", 35, 5, 1, "ro", "int32", "Audio manager max control time"],
  ["RESET_MAX_CONTROL_TIME", 35, 6, 1, "wo", "int32", "Reset audio manager max control time"],
  ["I2S_CURRENT_IDLE_TIME", 35, 7, 1, "ro", "int32", "I2S current idle time"],
  ["I2S_MIN_IDLE_TIME", 35, 8, 1, "ro", "int32", "I2S min idle time"],
  ["I2S_RESET_MIN_IDLE_TIME", 35, 9, 1, "wo", "int32", "I2S reset idle time"],
  ["I2S_INPUT_PACKED", 35, 10, 1, "rw", "uint8", "Expect packed input on I2S/USB channels"],
  [
    "AUDIO_MGR_SELECTED_AZIMUTHS",
    35,
    11,
    2,
    "ro",
    "radians",
    "Processed DoA and auto-select beam DoA",
  ],
  ["AUDIO_MGR_SELECTED_CHANNELS", 35, 12, 2, "rw", "uint8", "Selected channels for output mux"],
  ["AUDIO_MGR_OP_PACKED", 35, 13, 2, "rw", "uint8", "Packing status for L and R channels"],
  ["AUDIO_MGR_OP_UPSAMPLE", 35, 14, 2, "rw", "uint8", "Upsample status for L and R channels"],
  ["AUDIO_MGR_OP_L", 35, 15, 2, "rw", "uint8", "Category and source for L channel"],
  ["AUDIO_MGR_OP_R", 35, 19, 2, "rw", "uint8", "Category and source for R channel"],
  [
    "I2S_INACTIVE",
    35,
    24,
    1,
    "ro",
    "uint8",
    "Whether the main loop is exchanging samples with I2S",
  ],
  ["AUDIO_MGR_FAR_END_DSP_ENABLE", 35, 25, 1, "rw", "uint8", "Enable far-end DSP (0/1)"],
  ["AUDIO_MGR_SYS_DELAY", 35, 26, 1, "rw", "int32", "Delay applied to the reference signal"],
  ["I2S_DAC_DSP_ENABLE", 35, 27, 1, "rw", "uint8", "DAC performs DSP on far-end reference"],

  // GPO_SERVICER_RESID / LED (20)
  ["GPO_READ_VALUES", 20, 0, 5, "ro", "uint8", "Current logic level of all GPO pins"],
  ["GPO_WRITE_VALUE", 20, 1, 2, "wo", "uint8", "Set logic level of a GPO pin"],
  [
    "LED_EFFECT",
    20,
    12,
    1,
    "rw",
    "uint8",
    "LED effect: 0=off, 1=breath, 2=rainbow, 3=single, 4=doa, 5=ring",
  ],
  ["LED_BRIGHTNESS", 20, 13, 1, "rw", "uint8", "LED brightness for breath/rainbow"],
  ["LED_GAMMIFY", 20, 14, 1, "rw", "uint8", "Gamma correction (0=off, 1=on)"],
  ["LED_SPEED", 20, 15, 1, "rw", "uint8", "Effect speed for breath/rainbow"],
  ["LED_COLOR", 20, 16, 1, "rw", "uint32", "LED color for breath/single (0xRRGGBB)"],
  ["LED_DOA_COLOR", 20, 17, 2, "rw", "uint32", "DoA colors: base, highlight"],
  ["DOA_VALUE", 20, 18, 2, "ro", "uint16", "[angle 0..359, VAD 0/1]"],
  ["LED_RING_COLOR", 20, 19, 12, "rw", "uint32", "Per-LED color for ring mode"],

  // PP_RESID (17)
  ["PP_CURRENT_IDLE_TIME", 17, 70, 1, "ro", "uint32", "PP processing current idle time"],
  ["PP_MIN_IDLE_TIME", 17, 71, 1, "ro", "uint32", "PP processing minimum idle time"],
  ["PP_RESET_MIN_IDLE_TIME", 17, 72, 1, "wo", "uint32", "Reset PP minimum idle time"],
  ["PP_AGCONOFF", 17, 10, 1, "rw", "int32", "Automatic Gain Control (0/1)"],
  ["PP_AGCMAXGAIN", 17, 11, 1, "rw", "float", "Maximum AGC gain factor [1..1000]"],
  ["PP_AGCDESIREDLEVEL", 17, 12, 1, "rw", "float", "Target power level [1e-8..1.0]"],
  ["PP_AGCGAIN", 17, 13, 1, "rw", "float", "Current AGC gain factor"],
  ["PP_AGCTIME", 17, 14, 1, "rw", "float", "Ramp-up/down time constant (s)"],
  ["PP_AGCFASTTIME", 17, 15, 1, "rw", "float", "Fast ramp-down time constant (s)"],
  ["PP_AGCALPHAFASTGAIN", 17, 16, 1, "rw", "float", "Gain threshold for fast alpha mode"],
  ["PP_AGCALPHASLOW", 17, 17, 1, "rw", "float", "Slow memory parameter for speech power"],
  ["PP_AGCALPHAFAST", 17, 18, 1, "rw", "float", "Fast memory parameter for speech power"],
  ["PP_LIMITONOFF", 17, 19, 1, "rw", "int32", "Limiter on communication output (0/1)"],
  ["PP_LIMITPLIMIT", 17, 20, 1, "rw", "float", "Maximum limiter power"],
  ["PP_MIN_NS", 17, 21, 1, "rw", "float", "Gain floor for stationary noise suppression"],
  ["PP_MIN_NN", 17, 22, 1, "rw", "float", "Gain floor for non-stationary noise suppression"],
  ["PP_ECHOONOFF", 17, 23, 1, "rw", "int32", "Echo suppression (0/1)"],
  ["PP_GAMMA_E", 17, 24, 1, "rw", "float", "Over-subtraction factor of echo (direct/early)"],
  ["PP_GAMMA_ETAIL", 17, 25, 1, "rw", "float", "Over-subtraction factor of echo (tail)"],
  ["PP_GAMMA_ENL", 17, 26, 1, "rw", "float", "Over-subtraction factor of non-linear echo"],
  ["PP_NLATTENONOFF", 17, 27, 1, "rw", "int32", "Non-Linear echo attenuation (0/1)"],
  ["PP_NLAEC_MODE", 17, 28, 1, "rw", "int32", "Non-Linear AEC training mode (0/1/2)"],
  ["PP_FMIN_SPEINDEX", 17, 30, 1, "rw", "float", "Min frequency used in double-talk detection"],
  ["PP_DTSENSITIVE", 17, 31, 1, "rw", "int32", "Tradeoff between echo suppression and doubletalk"],
  ["PP_ATTNS_MODE", 17, 32, 1, "rw", "int32", "Extra AGC reduction during non-speech (0/1)"],
  ["PP_ATTNS_NOMINAL", 17, 33, 1, "rw", "float", "Non-speech attenuation at nominal speech level"],
  ["PP_ATTNS_SLOPE", 17, 34, 1, "rw", "float", "Extra attenuation slope during non-speech"],
];

export const PARAMETER_CATALOG: ParameterInfo[] = DEFS.map(
  ([name, resid, cmdid, length, access, kind, description]) => ({
    name,
    resid,
    cmdid,
    length,
    access,
    kind,
    description,
  })
);

const INDEX = new Map(PARAMETER_CATALOG.map((p) => [p.name, p] as const));

export function getParameter(name: string): ParameterInfo | undefined {
  return INDEX.get(name);
}
