'use client'

import { forwardRef, useMemo } from 'react'
import { BlendFunction, Effect, EffectAttribute } from 'postprocessing'
import { Uniform, Vector3 } from 'three'

/**
 * Final colour stage (replaces renderer tone mapping, which EffectComposer disables):
 *  1. ACES filmic (same curve as three.js) on scene pixels only. The sky background
 *     (depth == 1) is Poly Haven's pre-graded JPG and is already display-ready.
 *  2. Warm golden-hour grade on everything: split-tone (amber shadows, golden
 *     highlights), gentle saturation and contrast.
 * Put it after Bloom (bloom works on HDR values) and before Vignette.
 */
const fragmentShader = /* glsl */ `
uniform float exposure;
uniform float saturation;
uniform float contrast;
uniform vec3 shadowTint;
uniform vec3 highlightTint;
uniform float gradeAmount;
uniform float skyGradeAmount;
uniform float skySaturation;
uniform float skyWarm;

vec3 RRTAndODTFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}

vec3 acesFilmic(vec3 color) {
  const mat3 ACESInputMat = mat3(
    vec3(0.59719, 0.07600, 0.02840),
    vec3(0.35458, 0.90834, 0.13383),
    vec3(0.04823, 0.01566, 0.83777)
  );
  const mat3 ACESOutputMat = mat3(
    vec3( 1.60475, -0.10208, -0.00327),
    vec3(-0.53108,  1.10813, -0.07276),
    vec3(-0.07367, -0.00605,  1.07602)
  );
  color *= exposure / 0.6;
  color = ACESInputMat * color;
  color = RRTAndODTFit(color);
  color = ACESOutputMat * color;
  return clamp(color, 0.0, 1.0);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  vec3 c = inputColor.rgb;
  bool isSky = depth >= 0.99999;
  if (!isSky) c = acesFilmic(c);

  // grade (linear space). Warm split-tone everywhere; saturation + contrast on the scene only
  // (the sky JPG is already graded, so it only gets a lighter warm tint).
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  vec3 g = c * mix(shadowTint, highlightTint, smoothstep(0.0, 0.6, l));
  float gl = dot(g, vec3(0.2126, 0.7152, 0.0722));
  if (!isSky) {
    g = mix(vec3(gl), g, saturation);
    g = pow(max(g, vec3(0.0)) / 0.18, vec3(contrast)) * 0.18;
  } else {
    // calm the source JPG's yellow sun glow toward the video's white-gold disc
    g = mix(vec3(gl), g, skySaturation);
    // golden hour: orange near the horizon, peach higher up (instead of the JPG's pale grey-blue)
    vec3 warm = mix(vec3(1.16, 0.84, 0.62), vec3(1.05, 0.9, 0.82), smoothstep(0.25, 0.95, uv.y));
    g = mix(g, g * warm, skyWarm);
  }
  float amount = isSky ? skyGradeAmount : gradeAmount;
  outputColor = vec4(clamp(mix(c, g, amount), 0.0, 1.0), inputColor.a);
}
`

export type GoldenGradeOptions = {
  exposure?: number
  saturation?: number
  contrast?: number
  shadowTint?: [number, number, number]
  highlightTint?: [number, number, number]
  gradeAmount?: number
  skyGradeAmount?: number
  skySaturation?: number
  skyWarm?: number
}

export class GoldenGradeEffect extends Effect {
  constructor({
    exposure = 0.5,
    saturation = 1.1,
    contrast = 1.05,
    // tints are roughly luminance-neutral (they shift hue, not brightness)
    shadowTint = [1.04, 0.95, 0.86],
    highlightTint = [1.04, 0.97, 0.92], // peach rather than yellow (video highlights are peach-gold)
    gradeAmount = 1.0,
    skyGradeAmount = 1.0,
    skySaturation = 0.8,
    skyWarm = 0.6,
  }: GoldenGradeOptions = {}) {
    super('GoldenGradeEffect', fragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, Uniform>([
        ['exposure', new Uniform(exposure)],
        ['saturation', new Uniform(saturation)],
        ['contrast', new Uniform(contrast)],
        ['shadowTint', new Uniform(new Vector3(...shadowTint))],
        ['highlightTint', new Uniform(new Vector3(...highlightTint))],
        ['gradeAmount', new Uniform(gradeAmount)],
        ['skyGradeAmount', new Uniform(skyGradeAmount)],
        ['skySaturation', new Uniform(skySaturation)],
        ['skyWarm', new Uniform(skyWarm)],
      ]),
    })
  }
}

export const GoldenGrade = forwardRef<GoldenGradeEffect, GoldenGradeOptions>(function GoldenGrade(props, ref) {
  // Recreate only when options change (values are primitives/tuples).
  const key = JSON.stringify(props)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const effect = useMemo(() => new GoldenGradeEffect(props), [key])
  return <primitive ref={ref} object={effect} dispose={null} />
})
