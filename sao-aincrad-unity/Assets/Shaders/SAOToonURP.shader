// =============================================================================
//  SAO/ToonURP — the SAO/Toon cel shader ported to URP (Unity 6 / URP 17+,
//  also works on URP 12+). Same properties, same banding math, same look:
//
//  Pass 1: inverted-hull outline (SRPDefaultUnlit — URP draws untagged/unlit
//          passes alongside UniversalForward)
//  Pass 2: UniversalForward — URP is single-pass forward, so the main
//          directional light AND the point lights (lanterns) are banded here;
//          lantern pools posterize exactly like the Built-in ForwardAdd pass
//  Pass 3: ShadowCaster (so toon objects cast realtime shadows)
//  Pass 4: DepthOnly (depth prepass / depth texture support)
//
//  Notes vs the Built-in version:
//  * Flat ambient: URP has no UNITY_LIGHTMODEL_AMBIENT; with Environment
//    Lighting Source = Color the flat color arrives through SH, so
//    SampleSH(normal) returns the same single fill tone.
//  * Additional lights use the official LIGHT_LOOP macros so the shader works
//    on Forward, Forward+ and clustered paths (Unity 6 renamed the keyword,
//    both are declared below).
// =============================================================================
Shader "SAO/ToonURP"
{
    Properties
    {
        [Header(Base)]
        _Color ("Base Color", Color) = (1, 1, 1, 1)
        _MainTex ("Albedo (RGB)", 2D) = "white" {}

        [Header(Cel Bands)]
        _ShadowTint ("Shadow Tint", Color) = (0.62, 0.58, 0.75, 1)
        [IntRange] _Bands ("Light Bands", Range(2, 5)) = 2
        _BandSoftness ("Band Edge Softness", Range(0.0005, 0.15)) = 0.004
        _TerminatorShift ("Terminator Shift", Range(-0.45, 0.45)) = 0.0

        [Header(Specular)]
        _SpecularTint ("Specular Tint (black disables)", Color) = (0, 0, 0, 1)
        _Glossiness ("Specular Sharpness", Range(8, 512)) = 96
        _SpecSoftness ("Specular Edge Softness", Range(0.001, 0.2)) = 0.02

        [Header(Rim)]
        _RimColor ("Rim Color (alpha is strength)", Color) = (1, 0.92, 0.8, 0.25)
        _RimAmount ("Rim Threshold", Range(0, 1)) = 0.74
        _RimSoftness ("Rim Softness", Range(0.001, 0.25)) = 0.05

        [Header(Emission)]
        [HDR] _EmissionColor ("Emission (HDR drives bloom)", Color) = (0, 0, 0, 1)

        [Header(Outline)]
        [Toggle(OUTLINE_ON)] _OutlineOn ("Enable Outline", Float) = 1
        _OutlineColor ("Outline Color", Color) = (0.16, 0.11, 0.16, 1)
        _OutlineWidth ("Outline Width (pixels)", Range(0, 6)) = 1.6
    }

    SubShader
    {
        Tags
        {
            "RenderType" = "Opaque"
            "Queue" = "Geometry"
            "RenderPipeline" = "UniversalPipeline"
        }

        // Shared per-material data — identical CBUFFER in every pass keeps the
        // SRP Batcher happy.
        HLSLINCLUDE
        #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

        TEXTURE2D(_MainTex);
        SAMPLER(sampler_MainTex);

        CBUFFER_START(UnityPerMaterial)
            float4 _MainTex_ST;
            float4 _Color;
            float4 _ShadowTint;
            float  _Bands;
            float  _BandSoftness;
            float  _TerminatorShift;
            float4 _SpecularTint;
            float  _Glossiness;
            float  _SpecSoftness;
            float4 _RimColor;
            float  _RimAmount;
            float  _RimSoftness;
            float4 _EmissionColor;
            float4 _OutlineColor;
            float  _OutlineWidth;
        CBUFFER_END

        // Same quantizer as SAO/Toon: N flat tones, ~1px anti-aliased edges.
        float BandedLight(float raw)
        {
            float x    = saturate(raw + _TerminatorShift) * _Bands;
            float edge = max(fwidth(x), _BandSoftness * _Bands);
            float band = floor(x) + smoothstep(1.0 - edge, 1.0, frac(x));
            return saturate(band / (_Bands - 1.0));
        }
        ENDHLSL

        // ---------------------------------------------------------------------
        // PASS 1 — OUTLINE (inverted hull, constant pixel width)
        // ---------------------------------------------------------------------
        Pass
        {
            Name "OUTLINE"
            Tags { "LightMode" = "SRPDefaultUnlit" }
            Cull Front
            ZWrite On

            HLSLPROGRAM
            #pragma vertex vertOutline
            #pragma fragment fragOutline
            #pragma shader_feature_local OUTLINE_ON
            #pragma multi_compile_fog

            struct AttributesOutline
            {
                float4 positionOS : POSITION;
                float3 normalOS   : NORMAL;
            };

            struct VaryingsOutline
            {
                float4 positionCS : SV_POSITION;
                float  fogFactor  : TEXCOORD0;
            };

            VaryingsOutline vertOutline (AttributesOutline input)
            {
                VaryingsOutline output;
                float4 positionCS = TransformObjectToHClip(input.positionOS.xyz);

            #if defined(OUTLINE_ON)
                float3 normalWS = TransformObjectToWorldNormal(input.normalOS);
                float3 normalVS = mul((float3x3)UNITY_MATRIX_V, normalWS);

                float2 dir = normalVS.xy;
                dir /= max(length(dir), 1e-4);

                // pixels -> NDC (x2: NDC spans -1..1), * w cancels the divide.
                positionCS.xy += dir * (_OutlineWidth * 2.0 / _ScreenParams.xy) * positionCS.w;
            #endif

                output.positionCS = positionCS;
                output.fogFactor  = ComputeFogFactor(positionCS.z);
                return output;
            }

            float4 fragOutline (VaryingsOutline input) : SV_Target
            {
            #if !defined(OUTLINE_ON)
                clip(-1);   // outline disabled on this material: draw nothing
            #endif
                float3 col = MixFog(_OutlineColor.rgb, input.fogFactor);
                return float4(col, 1.0);
            }
            ENDHLSL
        }

        // ---------------------------------------------------------------------
        // PASS 2 — FORWARD (main light + additional lights, banded, single pass)
        // ---------------------------------------------------------------------
        Pass
        {
            Name "FORWARD_TOON"
            Tags { "LightMode" = "UniversalForward" }

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag

            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile _ _ADDITIONAL_LIGHTS_VERTEX _ADDITIONAL_LIGHTS
            #pragma multi_compile_fragment _ _ADDITIONAL_LIGHT_SHADOWS
            #pragma multi_compile_fragment _ _SHADOWS_SOFT
            // Forward+/clustered keyword: pre-6.1 name and the renamed one —
            // declaring an unused keyword is harmless, missing one kills the
            // lantern loop on that path.
            #pragma multi_compile _ _FORWARD_PLUS _CLUSTER_LIGHT_LOOP
            #pragma multi_compile_fog

            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"

            struct Attributes
            {
                float4 positionOS : POSITION;
                float3 normalOS   : NORMAL;
                float2 uv         : TEXCOORD0;
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float2 uv         : TEXCOORD0;
                float3 normalWS   : TEXCOORD1;
                float3 positionWS : TEXCOORD2;
                float  fogFactor  : TEXCOORD3;
            };

            Varyings vert (Attributes input)
            {
                Varyings output;
                VertexPositionInputs vpos = GetVertexPositionInputs(input.positionOS.xyz);
                output.positionCS = vpos.positionCS;
                output.positionWS = vpos.positionWS;
                output.normalWS   = TransformObjectToWorldNormal(input.normalOS);
                output.uv         = TRANSFORM_TEX(input.uv, _MainTex);
                output.fogFactor  = ComputeFogFactor(vpos.positionCS.z);
                return output;
            }

            float4 frag (Varyings input) : SV_Target
            {
                float3 n       = normalize(input.normalWS);
                float3 viewDir = normalize(GetWorldSpaceViewDir(input.positionWS));
                float4 albedo  = SAMPLE_TEXTURE2D(_MainTex, sampler_MainTex, input.uv) * _Color;

                // ---- main (directional) light, shadow folded into the band --
                float4 shadowCoord = TransformWorldToShadowCoord(input.positionWS);
                Light mainLight = GetMainLight(shadowCoord);
                float atten = mainLight.shadowAttenuation * mainLight.distanceAttenuation;
                float ndl   = dot(n, mainLight.direction);
                float shade = BandedLight(saturate(ndl) * atten);

                float3 litCol    = albedo.rgb;
                float3 shadowCol = albedo.rgb * _ShadowTint.rgb;
                float3 color     = lerp(shadowCol, litCol, shade) * mainLight.color;

                // Flat ambient (Environment Lighting Source = Color -> SH L0).
                color += SampleSH(n) * albedo.rgb;

                // Sharp anime specular, lit side only.
                float3 halfDir  = normalize(mainLight.direction + viewDir);
                float  specRaw  = pow(saturate(dot(n, halfDir)), _Glossiness);
                float  specBand = smoothstep(0.5 - _SpecSoftness, 0.5 + _SpecSoftness, specRaw) * shade;
                color += specBand * _SpecularTint.rgb * mainLight.color;

                // Rim restricted to the lit side.
                float rimDot = 1.0 - saturate(dot(viewDir, n));
                float rim    = smoothstep(_RimAmount - _RimSoftness,
                                          _RimAmount + _RimSoftness,
                                          rimDot * saturate(ndl));
                color += rim * _RimColor.rgb * _RimColor.a;

                // ---- additional lights (lanterns, fireplace): banded pools --
            #if defined(_ADDITIONAL_LIGHTS) || defined(_ADDITIONAL_LIGHTS_VERTEX)
                // InputData fields the LIGHT_LOOP macros read on Forward+.
                InputData inputData = (InputData)0;
                inputData.positionWS = input.positionWS;
                inputData.normalizedScreenSpaceUV = GetNormalizedScreenSpaceUV(input.positionCS);

                uint lightCount = GetAdditionalLightsCount();
                LIGHT_LOOP_BEGIN(lightCount)
                    Light l = GetAdditionalLight(lightIndex, input.positionWS, half4(1, 1, 1, 1));
                    float lit  = saturate(dot(n, l.direction)) * l.distanceAttenuation * l.shadowAttenuation;
                    float pool = BandedLight(lit);   // flat painted pool, not smooth falloff
                    color += albedo.rgb * l.color * pool;

                    float3 hD = normalize(l.direction + viewDir);
                    float  sR = pow(saturate(dot(n, hD)), _Glossiness);
                    float  sB = smoothstep(0.5 - _SpecSoftness, 0.5 + _SpecSoftness, sR) * pool;
                    color += sB * _SpecularTint.rgb * l.color;
                LIGHT_LOOP_END
            #endif

                color += _EmissionColor.rgb;
                color  = MixFog(color, input.fogFactor);
                return float4(color, 1.0);
            }
            ENDHLSL
        }

        // ---------------------------------------------------------------------
        // PASS 3 — SHADOW CASTER
        // ---------------------------------------------------------------------
        Pass
        {
            Name "ShadowCaster"
            Tags { "LightMode" = "ShadowCaster" }
            ZWrite On
            ZTest LEqual
            ColorMask 0
            Cull Back

            HLSLPROGRAM
            #pragma vertex vertShadow
            #pragma fragment fragShadow
            #pragma multi_compile_vertex _ _CASTING_PUNCTUAL_LIGHT_SHADOW

            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Shadows.hlsl"

            float3 _LightDirection;
            float3 _LightPosition;

            struct AttributesShadow
            {
                float4 positionOS : POSITION;
                float3 normalOS   : NORMAL;
            };

            struct VaryingsShadow
            {
                float4 positionCS : SV_POSITION;
            };

            VaryingsShadow vertShadow (AttributesShadow input)
            {
                VaryingsShadow output;
                float3 positionWS = TransformObjectToWorld(input.positionOS.xyz);
                float3 normalWS   = TransformObjectToWorldNormal(input.normalOS);

            #if defined(_CASTING_PUNCTUAL_LIGHT_SHADOW)
                float3 lightDirectionWS = normalize(_LightPosition - positionWS);
            #else
                float3 lightDirectionWS = _LightDirection;
            #endif

                float4 positionCS = TransformWorldToHClip(
                    ApplyShadowBias(positionWS, normalWS, lightDirectionWS));

            #if UNITY_REVERSED_Z
                positionCS.z = min(positionCS.z, UNITY_NEAR_CLIP_VALUE);
            #else
                positionCS.z = max(positionCS.z, UNITY_NEAR_CLIP_VALUE);
            #endif

                output.positionCS = positionCS;
                return output;
            }

            float4 fragShadow (VaryingsShadow input) : SV_Target
            {
                return 0;
            }
            ENDHLSL
        }

        // ---------------------------------------------------------------------
        // PASS 4 — DEPTH ONLY (depth prepass / camera depth texture)
        // ---------------------------------------------------------------------
        Pass
        {
            Name "DepthOnly"
            Tags { "LightMode" = "DepthOnly" }
            ZWrite On
            ColorMask R
            Cull Back

            HLSLPROGRAM
            #pragma vertex vertDepth
            #pragma fragment fragDepth

            struct AttributesDepth
            {
                float4 positionOS : POSITION;
            };

            struct VaryingsDepth
            {
                float4 positionCS : SV_POSITION;
            };

            VaryingsDepth vertDepth (AttributesDepth input)
            {
                VaryingsDepth output;
                output.positionCS = TransformObjectToHClip(input.positionOS.xyz);
                return output;
            }

            float4 fragDepth (VaryingsDepth input) : SV_Target
            {
                return 0;
            }
            ENDHLSL
        }
    }

    FallBack Off
}
