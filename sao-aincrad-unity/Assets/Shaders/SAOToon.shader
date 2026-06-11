// =============================================================================
//  SAO/Toon — anime cel shader for the Built-in Render Pipeline (Unity 2022.3)
//
//  Pass 1: inverted-hull outline (screen-space constant pixel width)
//  Pass 2: ForwardBase  — directional light, flat banded diffuse, sharp
//          specular dot, rim light, flat ambient, emission, shadows
//  Pass 3: ForwardAdd   — point/spot lights (lanterns!), additive, with the
//          same banding so light pools posterize like painted anime light
//
//  Design notes:
//  * Diffuse is quantized into N flat bands. The shadow band is NOT black —
//    it is albedo multiplied by _ShadowTint, which should be a cool violet
//    for the anime look (anime shadows shift hue, never just darken).
//  * Realtime shadow attenuation is multiplied into the band function, so
//    cast shadows get the same crisp painted edge as the terminator.
//  * Ambient uses the flat ambient color (set Ambient Source = Color in the
//    Lighting window) so shaded areas stay one clean tone.
//  * Outline is extruded in clip space and scaled by w, giving a constant
//    on-screen line weight like the show's ink lines. Works best on smooth
//    meshes (spheres, capsules, characters). Hard-edged cubes show small
//    corner gaps — leave outlines off on big architecture, on for props.
// =============================================================================
Shader "SAO/Toon"
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
        Tags { "RenderType" = "Opaque" "Queue" = "Geometry" }

        // Shared uniforms + helpers, concatenated into every pass below.
        CGINCLUDE
        #include "UnityCG.cginc"

        sampler2D _MainTex;
        float4 _MainTex_ST;
        fixed4 _Color;
        fixed4 _ShadowTint;
        float  _Bands;
        float  _BandSoftness;
        float  _TerminatorShift;
        fixed4 _SpecularTint;
        float  _Glossiness;
        float  _SpecSoftness;
        fixed4 _RimColor;
        float  _RimAmount;
        float  _RimSoftness;
        fixed4 _EmissionColor;
        fixed4 _OutlineColor;
        float  _OutlineWidth;

        // Quantizes a 0..1 light value into _Bands flat tones with a thin,
        // screen-space anti-aliased edge between neighbouring bands.
        // fwidth() keeps the edge ~1px wide regardless of distance.
        float BandedLight(float raw)
        {
            float x    = saturate(raw + _TerminatorShift) * _Bands;
            float edge = max(fwidth(x), _BandSoftness * _Bands);
            float band = floor(x) + smoothstep(1.0 - edge, 1.0, frac(x));
            return saturate(band / (_Bands - 1.0));
        }
        ENDCG

        // ---------------------------------------------------------------------
        // PASS 1 — OUTLINE (inverted hull)
        // Renders backfaces pushed outward along the view-space normal in clip
        // space, so the line stays a constant pixel width at any distance.
        // ---------------------------------------------------------------------
        Pass
        {
            Name "OUTLINE"
            Cull Front
            ZWrite On

            CGPROGRAM
            #pragma vertex vertOutline
            #pragma fragment fragOutline
            #pragma shader_feature_local OUTLINE_ON
            #pragma multi_compile_fog
            #pragma target 3.0

            struct appdataOutline
            {
                float4 vertex : POSITION;
                float3 normal : NORMAL;
            };

            struct v2fOutline
            {
                float4 pos : SV_POSITION;
                UNITY_FOG_COORDS(0)
            };

            v2fOutline vertOutline (appdataOutline v)
            {
                v2fOutline o;
                float4 clipPos = UnityObjectToClipPos(v.vertex);

            #if defined(OUTLINE_ON)
                float3 worldNormal = UnityObjectToWorldNormal(v.normal);
                float3 viewNormal  = mul((float3x3)UNITY_MATRIX_V, worldNormal);

                // Direction of the push on screen; guard against zero-length
                // when the normal points straight at the camera.
                float2 dir = viewNormal.xy;
                dir /= max(length(dir), 1e-4);

                // pixels -> NDC (x2 because NDC spans -1..1), then * w so the
                // perspective divide cancels and width stays constant on screen.
                clipPos.xy += dir * (_OutlineWidth * 2.0 / _ScreenParams.xy) * clipPos.w;
            #endif

                o.pos = clipPos;
                UNITY_TRANSFER_FOG(o, o.pos);
                return o;
            }

            fixed4 fragOutline (v2fOutline i) : SV_Target
            {
            #if !defined(OUTLINE_ON)
                clip(-1);   // outline disabled on this material: draw nothing
            #endif
                fixed4 col = _OutlineColor;
                UNITY_APPLY_FOG(i.fogCoord, col);
                return col;
            }
            ENDCG
        }

        // ---------------------------------------------------------------------
        // PASS 2 — FORWARD BASE (main directional light + ambient + emission)
        // ---------------------------------------------------------------------
        Pass
        {
            Name "FORWARD_BASE"
            Tags { "LightMode" = "ForwardBase" }

            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_fwdbase
            #pragma multi_compile_fog
            #pragma target 3.0

            #include "Lighting.cginc"
            #include "AutoLight.cginc"

            struct appdata
            {
                float4 vertex   : POSITION;
                float3 normal   : NORMAL;
                float2 texcoord : TEXCOORD0;
            };

            struct v2f
            {
                float4 pos         : SV_POSITION;
                float2 uv          : TEXCOORD0;
                float3 worldNormal : TEXCOORD1;
                float3 worldPos    : TEXCOORD2;
                LIGHTING_COORDS(3, 4)       // realtime shadow coords
                UNITY_FOG_COORDS(5)
            };

            v2f vert (appdata v)
            {
                v2f o;
                o.pos         = UnityObjectToClipPos(v.vertex);
                o.uv          = TRANSFORM_TEX(v.texcoord, _MainTex);
                o.worldNormal = UnityObjectToWorldNormal(v.normal);
                o.worldPos    = mul(unity_ObjectToWorld, v.vertex).xyz;
                TRANSFER_VERTEX_TO_FRAGMENT(o);
                UNITY_TRANSFER_FOG(o, o.pos);
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                float3 n        = normalize(i.worldNormal);
                float3 lightDir = normalize(_WorldSpaceLightPos0.xyz); // directional
                float3 viewDir  = normalize(_WorldSpaceCameraPos - i.worldPos);

                fixed4 albedo = tex2D(_MainTex, i.uv) * _Color;

                // Shadow term folded into the band so cast shadows get the
                // same crisp painted edge as the lighting terminator.
                float atten = LIGHT_ATTENUATION(i);
                float ndl   = dot(n, lightDir);
                float shade = BandedLight(saturate(ndl) * atten);

                // Two flat colours: full albedo in light, hue-shifted in shade.
                float3 litCol    = albedo.rgb;
                float3 shadowCol = albedo.rgb * _ShadowTint.rgb;
                float3 diffuse   = lerp(shadowCol, litCol, shade) * _LightColor0.rgb;

                // Flat ambient — relies on Ambient Source = Color.
                float3 ambient = UNITY_LIGHTMODEL_AMBIENT.rgb * albedo.rgb;

                // Sharp anime specular: tiny hard-edged dot, only on lit side.
                float3 halfDir  = normalize(lightDir + viewDir);
                float  specRaw  = pow(saturate(dot(n, halfDir)), _Glossiness);
                float  specBand = smoothstep(0.5 - _SpecSoftness, 0.5 + _SpecSoftness, specRaw) * shade;
                float3 specular = specBand * _SpecularTint.rgb * _LightColor0.rgb;

                // Rim restricted to the lit side (classic anime back-glow).
                float rimDot = 1.0 - saturate(dot(viewDir, n));
                float rim    = smoothstep(_RimAmount - _RimSoftness,
                                          _RimAmount + _RimSoftness,
                                          rimDot * saturate(ndl));
                float3 rimCol = rim * _RimColor.rgb * _RimColor.a;

                fixed4 col;
                col.rgb = diffuse + ambient + specular + rimCol + _EmissionColor.rgb;
                col.a   = 1.0;
                UNITY_APPLY_FOG(i.fogCoord, col);
                return col;
            }
            ENDCG
        }

        // ---------------------------------------------------------------------
        // PASS 3 — FORWARD ADD (point/spot lights: lanterns, fireplace)
        // Additive. Attenuation is banded too, so lanterns throw flat pools
        // of warm light with a painted edge instead of a smooth CG falloff.
        // ---------------------------------------------------------------------
        Pass
        {
            Name "FORWARD_ADD"
            Tags { "LightMode" = "ForwardAdd" }
            Blend One One
            ZWrite Off

            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_fwdadd_fullshadows
            #pragma multi_compile_fog
            #pragma target 3.0

            #include "Lighting.cginc"
            #include "AutoLight.cginc"

            struct appdata
            {
                float4 vertex   : POSITION;
                float3 normal   : NORMAL;
                float2 texcoord : TEXCOORD0;
            };

            struct v2f
            {
                float4 pos         : SV_POSITION;
                float2 uv          : TEXCOORD0;
                float3 worldNormal : TEXCOORD1;
                float3 worldPos    : TEXCOORD2;
                LIGHTING_COORDS(3, 4)       // distance atten + cookies + shadows
                UNITY_FOG_COORDS(5)
            };

            v2f vert (appdata v)
            {
                v2f o;
                o.pos         = UnityObjectToClipPos(v.vertex);
                o.uv          = TRANSFORM_TEX(v.texcoord, _MainTex);
                o.worldNormal = UnityObjectToWorldNormal(v.normal);
                o.worldPos    = mul(unity_ObjectToWorld, v.vertex).xyz;
                TRANSFER_VERTEX_TO_FRAGMENT(o);
                UNITY_TRANSFER_FOG(o, o.pos);
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                float3 n        = normalize(i.worldNormal);
                float3 lightDir = normalize(UnityWorldSpaceLightDir(i.worldPos));
                float3 viewDir  = normalize(_WorldSpaceCameraPos - i.worldPos);

                fixed4 albedo = tex2D(_MainTex, i.uv) * _Color;

                float atten = LIGHT_ATTENUATION(i);
                float lit   = saturate(dot(n, lightDir)) * atten;
                float shade = BandedLight(lit);

                float3 diffuse = albedo.rgb * _LightColor0.rgb * shade;

                // Small hot dot from local lights (nice on brass + varnish).
                float3 halfDir  = normalize(lightDir + viewDir);
                float  specRaw  = pow(saturate(dot(n, halfDir)), _Glossiness);
                float  specBand = smoothstep(0.5 - _SpecSoftness, 0.5 + _SpecSoftness, specRaw) * shade;
                float3 specular = specBand * _SpecularTint.rgb * _LightColor0.rgb;

                fixed4 col;
                col.rgb = diffuse + specular;
                col.a   = 1.0;
                // Additive pass fades to black in fog, not to fog colour.
                UNITY_APPLY_FOG_COLOR(i.fogCoord, col, fixed4(0, 0, 0, 0));
                return col;
            }
            ENDCG
        }
    }

    // Gives us a ShadowCaster pass so toon objects cast realtime shadows.
    Fallback "Diffuse"
}
