import { $up } from './uploop.core.js';
import { createUUID } from './uploop.utils.js';

export const breakpoints = {
    z: 0,
    sm: 576,
    md: 768,
    lg: 992,
    xl: 1200,
    xl2: 1536,
    xl3: 1920,
    xl4: 2560,
    xl5: 3840
};

export const relativeScales = {
    none: 0,
    xs: 0.75,
    sm: 0.875,
    base: 1,
    md: 1.25,
    lg: 1.5,
    xl: 2,
    xl2: 2.5,
    xl3: 3,
    xl4: 4,
    xl5: 5,
    xl6: 6,
    full: 'full',
    auto: 'auto',
    fit: 'fit',
    min: 'min',
    max: 'max',
};

export const percentageScales = {}

for (let i = 0; i < 100; i++) {
    percentageScales[`pc${i}`] = i;
}

export const spacingByPx = {};

for (let i = 0; i < 13; i++) {
    let step = 4 + i % 4;
    spacingByPx[`${i}`] = i * step;
}

export const spacingByRem = {};

for (let i = 0; i < 13; i++) {
    spacingByRem[`${i}`] = i;
    spacingByRem[`${i}_25`] = i + 0.25;
    spacingByRem[`${i}_5`] = i + 0.5;
    spacingByRem[`${i}_75`] = i + 0.75;
}

export const spacingByRemTiny = {
    "t2": -0.05,
    "t1": -0.025,
    'z': 0,
    'normal': 0,
    "w1": 0.025,
    "w2": 0.05,
    "w3": 0.1,
};

export const positioning = {
    static: 'static',
    relative: 'relative',
    absolute: 'absolute',
    fixed: 'fixed',
    sticky: 'sticky'
};

export const relativePositioning = {
    top: 'top',
    right: 'right',
    bottom: 'bottom',
    left: 'left'
};

export const relativePositioningShort = {
    t: 'top',
    r: 'right',
    b: 'bottom',
    l: 'left',
    x: 'left right',
    y: 'top bottom',
    tl: 'top left',
    tr: 'top right',
    bl: 'bottom left',
    br: 'bottom right'
};
// Color-scheme --------------------------------------------------------------
export const defaultColorScheme = {
    transparent: 'transparent',
    // color signals
    primary: '#007bff',
    secondary: '#6c757d',
    success: '#28a745',
    info: '#17a2b8',
    warning: '#ffc107',
    danger: '#dc3545',
    light: '#f8f9fa',
    dark: '#343a40',

    // color palette
    white: '#ffffff',
    black: '#000000',
    gray: '#6c757d',
    grayDark: '#343a40',
    yellow: '#ffc107',
    orange: '#fd7e14',
    red: '#dc3545',
    pink: '#e83e8c',
    maroon: '#800000',
    green: '#28a745',
    teal: '#20c997',
    cyan: '#17a2b8',
    blue: '#007bff',
    navy: '#001f3f',
    purple: '#6f42c1',
    fuchsia: '#e83e8c',
    lime: '#00ff00',
    olive: '#808000',
    aqua: '#00ffff',
    silver: '#c0c0c0',
};

// create colorshades
export const colorShades = (colorKey, color, steps) => {
    const colorShades = {};
    for (let i = 1; i < steps; i++) {
        // make new color shade from color, from light to dark
        // https://stackoverflow.com/questions/5560248/programmatically-lighten-or-darken-a-hex-color-or-rgb-and-blend-colors
        let newColor;
        ({ newColor, color } = colorShade(color, i));

        colorShades[`${colorKey}-${i}`] = newColor;
    }
    return colorShades;
}



// all html predefined colors
export const colorCodes = () => { }


export function colorShade(color, i) {
    const amt = i * 10;
    let usePound = true;
    if (color[0] == "#") {
        color = color.slice(1);
        usePound = true;
    }
    let num = parseInt(color, 16);
    let r = (num >> 16) + amt;
    if (r > 255) r = 255;
    else if (r < 0) r = 0;
    let b = ((num >> 8) & 0x00FF) + amt;
    if (b > 255) b = 255;
    else if (b < 0) b = 0;
    let g = (num & 0x0000FF) + amt;
    if (g > 255) g = 255;
    else if (g < 0) g = 0;
    const newColor = (usePound ? "#" : "") + (g | (b << 8) | (r << 16)).toString(16);
    return { newColor, color };
}

// define css variables of color scheme
function createCodeShadesVars(sheet) {
    Object.entries(defaultColorScheme).map(([key, value]) => {
        const newColorShades = colorShades(key, value, 10);
        Object.assign(defaultColorScheme, newColorShades);
    });

    // var rootElement = document.querySelector(':root');
    let ruleText = '';
    Object.entries(defaultColorScheme).map(([key, value]) => {
        // style.setProperty(`--color-${key}`, value);
        ruleText += `--color-${key}: ${value};`;
    });
    sheet.insertRule(`:root { ${ruleText} }`);

    console.log(defaultColorScheme);
}

// Typography -----------------------------------------------------------------

// Styles ---------------------------------------------------------------------
export function createStyle(sheet, styleSelector, styleDesc) {
    sheet.insertRule(`${styleSelector} { ${styleDesc} }`);
}

export function createGlobalStyles() {
    const style = document.createElement("style");
    document.head.appendChild(style);
    const sheet = style.sheet;
    createUtilityStylesInSheet(sheet);
    createCodeShadesVars(sheet);

    return [sheet];
}

export function createGlobalStylesShadow() {
    const sheet = new CSSStyleSheet();
    createUtilityStylesInSheet(sheet);
    createCodeShadesVars(sheet);

    return [sheet];
}

export function createResponsiveStyles(styleNames) {

}

export function createWrappedStyles(styleJson) {

}

export function createCombinedStyles(styleNames) {

}


export function setupPredefinedStyles(element) {
    const sheet = new CSSStyleSheet();

    // margin
    createUtilityStylesInSheet(sheet);

    if (element && element.shadowRoot) {
        console.log('add StyleSheets', element, sheet);
        element.shadowRoot.adoptedStyleSheets = [sheet];
    }
}

// every measurement in rem
function createUtilityStylesInSheet(sheet) {
    //Margin
    Object.entries(spacingByRem).map(([key, value]) => {
        createStyle(sheet, `.m-${key}`, `margin: ${value}rem;`);
        createStyle(sheet, `.mt-${key}`, `margin-top: ${value}rem;`);
        createStyle(sheet, `.mr-${key}`, `margin-right: ${value}rem;`);
        createStyle(sheet, `.mb-${key}`, `margin-bottom: ${value}rem;`);
        createStyle(sheet, `.ml-${key}`, `margin-left: ${value}rem;`);
        createStyle(sheet, `.mx-${key}`, `margin-left: ${value}rem;margin-right: ${value}rem;`);
        createStyle(sheet, `.my-${key}`, `margin-top: ${value}rem;margin-bottom: ${value}rem;`);
    });

    [...Array(24).keys()].map((key) => {
        createStyle(sheet, `.m-${key}px`, `margin: ${key}px;`);
        createStyle(sheet, `.mt-${key}px`, `margin-top: ${key}px;`);
        createStyle(sheet, `.mr-${key}px`, `margin-right: ${key}px;`);
        createStyle(sheet, `.mb-${key}px`, `margin-bottom: ${key}px;`);
        createStyle(sheet, `.ml-${key}px`, `margin-left: ${key}px;`);
        createStyle(sheet, `.mx-${key}px`, `margin-left: ${key}px;margin-right: ${key}px;`);
        createStyle(sheet, `.my-${key}px`, `margin-top: ${key}px;margin-bottom: ${key}px;`);
    });

    //Padding
    Object.entries(spacingByRem).map(([key, value]) => {
        createStyle(sheet, `.p-${key}`, `padding: ${value}rem;`);
        createStyle(sheet, `.pt-${key}`, `padding-top: ${value}rem;`);
        createStyle(sheet, `.pr-${key}`, `padding-right: ${value}rem;`);
        createStyle(sheet, `.pb-${key}`, `padding-bottom: ${value}rem;`);
        createStyle(sheet, `.pl-${key}`, `padding-left: ${value}rem;`);
        createStyle(sheet, `.px-${key}`, `padding-left: ${value}rem;padding-right: ${value}rem;`);
        createStyle(sheet, `.py-${key}`, `padding-top: ${value}rem;padding-bottom: ${value}rem;`);
    });

    // Padding pixels
    [...Array(24).keys()].map((key) => {
        createStyle(sheet, `.p-${key}px`, `padding: ${key}px;`);
        createStyle(sheet, `.pt-${key}px`, `padding-top: ${key}px;`);
        createStyle(sheet, `.pr-${key}px`, `padding-right: ${key}px;`);
        createStyle(sheet, `.pb-${key}px`, `padding-bottom: ${key}px;`);
        createStyle(sheet, `.pl-${key}px`, `padding-left: ${key}px;`);
        createStyle(sheet, `.px-${key}px`, `padding-left: ${key}px;padding-right: ${key}px;`);
        createStyle(sheet, `.py-${key}px`, `padding-top: ${key}px;padding-bottom: ${key}px;`);
    });

    // border ---------------------------------------------------------------
    // border width
    // Object.entries(spacingByRem).map(([key, value]) => {
    //     createStyle(sheet, `.b-${key}`, `border: ${value}rem;`);
    //     createStyle(sheet, `.bt-${key}`, `border-top: ${value}rem;`);
    //     createStyle(sheet, `.br-${key}`, `border-right: ${value}rem;`);
    //     createStyle(sheet, `.bb-${key}`, `border-bottom: ${value}rem;`);
    //     createStyle(sheet, `.bl-${key}`, `border-left: ${value}rem;`);
    // });

    // border color
    Object.keys(defaultColorScheme).map((v) => {
        createStyle(sheet, `.border-${v}`, `border-color: ${defaultColorScheme[v]};`);
    });

    // border style
    ['solid', 'dashed', 'dotted', 'double', 'none'].map((v) => {
        createStyle(sheet, `.border-${v}`, `border-style: ${v};`);
    });


    // rounded
    Object.entries(spacingByRem).map(([key, value]) => {
        createStyle(sheet, `.rounded-${key}`, `border-radius: ${value}rem;`);
    });
    Object.entries(relativeScales).map(([key, value]) => {
        createStyle(sheet, `.rounded-${key}`, `border-radius: ${value}rem;`);
    });
    Object.entries(percentageScales).map(([key, value]) => {
        createStyle(sheet, `.rounded-${key}`, `border-radius: ${value}%;`);
    });

    // text ---------------------------------------------------------------
    // text weight
    ['normal', 'bold', 'bolder', 'lighter'].map((v) => {
        createStyle(sheet, `.text-${v}`, `font-weight: ${v};`);
    });

    // text align
    ['left', 'center', 'right', 'justify'].map((v) => {
        createStyle(sheet, `.text-${v}`, `text-align: ${v};`);
    });

    // text transform
    ['uppercase', 'lowercase', 'capitalize', 'none'].map((v) => {
        createStyle(sheet, `.text-${v}`, `text-transform: ${v};`);
    });

    // text color
    Object.keys(defaultColorScheme).map((v) => {
        createStyle(sheet, `.text-${v}`, `color: ${defaultColorScheme[v]};`);
    });

    // text indent
    Object.entries(spacingByRem).map(([key, value]) => {
        createStyle(sheet, `.text-indent-${key}`, `text-indent: ${value}rem;`);
    });

    // text overflow
    ['clip', 'ellipsis'].map((v) => {
        createStyle(sheet, `.text-overflow-${v}`, `text-overflow: ${v};`);
    });

    // text shadow
    Object.entries(spacingByRem).map(([key, value]) => {
        createStyle(sheet, `.text-shadow-${key}`, `text-shadow: 0 0 ${value}rem rgba(0, 0, 0, 0.2);`);
    });

    //text wrap
    ['normal', 'nowrap', 'pre', 'pre-line', 'pre-wrap'].map((v) => {
        createStyle(sheet, `.text-wrap-${v}`, `white-space: ${v};`);
    });

    // text decoration ---------------------------------------------------------------
    // text decoration color
    Object.keys(defaultColorScheme).map((v) => {
        createStyle(sheet, `.text-decoration-${v}`, `text-decoration-color: ${defaultColorScheme[v]};`);
    });

    // text decoration line
    ['none', 'underline', 'overline', 'line-through', 'blink'].map((v) => {
        createStyle(sheet, `.text-decoration-${v}`, `text-decoration-line: ${v};`);
    });

    // text decoration style
    ['solid', 'double', 'dotted', 'dashed', 'wavy'].map((v) => {
        createStyle(sheet, `.text-decoration-${v}`, `text-decoration-style: ${v};`);
    });

    // text decoration thickness
    Object.entries(spacingByRem).map(([key, value]) => {
        createStyle(sheet, `.text-decoration-${key}`, `text-decoration-thickness: ${value}rem;`);
    });

    // font ---------------------------------------------------------------
    // font size
    Object.entries(spacingByRem).map(([key, value]) => {
        createStyle(sheet, `.text-${key}`, `font-size: ${value}rem;`);
    });

    // font family
    ['sans', 'serif', 'mono'].map((v) => {
        createStyle(sheet, `.font-${v}`, `font-family: ${v};`);
    });

    // font style
    ['italic', 'normal', 'oblique'].map((v) => {
        createStyle(sheet, `.font-${v}`, `font-style: ${v};`);
    });

    // font weight
    ['normal', 'bold', 'bolder', 'lighter'].map((v) => {
        createStyle(sheet, `.font-${v}`, `font-weight: ${v};`);
    });

    // font variant
    ['normal', 'small-caps'].map((v) => {
        createStyle(sheet, `.font-${v}`, `font-variant: ${v};`);
    });

    // font variant numeric
    ['lining-nums', 'oldstyle-nums', 'proportional-nums', 'tabular-nums'].map((v) => {
        createStyle(sheet, `.font-vn-${v}`, `font-variant-numeric: ${v};`);
    });

    // font variant position
    ['normal', 'sub', 'super'].map((v) => {
        createStyle(sheet, `.font-vp-${v}`, `font-variant-position: ${v};`);
    });

    // line ---------------------------------------------------------------
    // line height
    Object.entries(spacingByRem).map(([key, value]) => {
        createStyle(sheet, `.line-h-${key}`, `line-height: ${value}rem;`);
    });

    // line style
    ['none', 'solid', 'double', 'dotted', 'dashed'].map((v) => {
        createStyle(sheet, `.line-s-${v}`, `line-style: ${v};`);
        createStyle(sheet, `.line-style-${v}`, `line-style: ${v};`);
    });

    // line width
    Object.entries(spacingByRem).map(([key, value]) => {
        createStyle(sheet, `.line-w-${key}`, `line-width: ${value}rem;`);
    });

    // letter ---------------------------------------------------------------
    // letter spacing
    Object.entries(spacingByRemTiny).map(([key, value]) => {
        createStyle(sheet, `.letter-spacing-${key}`, `letter-spacing: ${value}rem;`);
    });

    // list ---------------------------------------------------------------
    // list style type
    ['none', 'disc', 'circle', 'square', 'decimal', 'decimal-leading-zero', 'lower-roman', 'upper-roman', 'lower-greek', 'lower-latin', 'upper-latin', 'armenian', 'georgian', 'lower-alpha', 'upper-alpha', 'none'].map((v) => {
        createStyle(sheet, `.list-style-${v}`, `list-style-type: ${v};`);
    });

    // list style position
    ['inside', 'outside'].map((v) => {
        createStyle(sheet, `.list-style-${v}`, `list-style-position: ${v};`);
    });

    // list style image
    ['none'].map((v) => {
        createStyle(sheet, `.list-style-${v}`, `list-style-image: ${v};`);
    });

    // content ---------------------------------------------------------------
    // content
    ['normal', 'none'].map((v) => {
        createStyle(sheet, `.content-${v}`, `content: ${v};`);
    });

    // quotes


    // white space ---------------------------------------------------------------
    ['normal', 'nowrap', 'pre', 'pre-line', 'pre-wrap'].map((v) => {
        createStyle(sheet, `.white-space-${v}`, `white-space: ${v};`);
    });

    // word break
    ['normal', 'break-all', 'keep-all', 'break-word'].map((v) => {
        createStyle(sheet, `.word-break-${v}`, `word-break: ${v};`);
    });

    // word spacing
    Object.entries(spacingByRem).map(([key, value]) => {
        createStyle(sheet, `.word-spacing-${key}`, `word-spacing: ${value}rem;`);
    });

    // word wrap
    ['normal', 'break-word'].map((v) => {
        createStyle(sheet, `.word-wrap-${v}`, `word-wrap: ${v};`);
    });

    // hyphens
    ['none', 'manual', 'auto'].map((v) => {
        createStyle(sheet, `.hyphens-${v}`, `hyphens: ${v};`);
    });

    // background ---------------------------------------------------------------

    // background image position
    ['left', 'right', 'center'].map((v) => {
        createStyle(sheet, `.bg-pos-${v}`, `background-position: ${v};`);
    });

    // background image size
    ['auto', 'cover', 'contain'].map((v) => {
        createStyle(sheet, `.bg-size-${v}`, `background-size: ${v};`);
    });

    // background repeat
    ['no-repeat', 'repeat', 'repeat-x', 'repeat-y', 'space', 'round'].map((v) => {
        createStyle(sheet, `.bg-repeat-${v}`, `background-repeat: ${v};`);
    });

    // background attachment
    ['scroll', 'fixed', 'local'].map((v) => {
        createStyle(sheet, `.bg-attachment-${v}`, `background-attachment: ${v};`);
    });

    // background blend mode
    ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'].map((v) => {
        createStyle(sheet, `.bg-blend-${v}`, `background-blend-mode: ${v};`);
    });

    // background color
    Object.keys(defaultColorScheme).map((v) => {
        createStyle(sheet, `.bg-color-${v}`, `background-color: ${defaultColorScheme[v]};`);
    });

    // position ---------------------------------------------------------------
    ['static', 'relative', 'absolute', 'fixed', 'sticky'].map((v) => {
        createStyle(sheet, `.pos-${v}`, `position: ${v};`);
        createStyle(sheet, `.position-${v}`, `position: ${v};`);
    });

    // display
    ['block', 'inline-block', 'inline', 'flex', 'grid', 'table', 'table-cell'].map((v) => {
        createStyle(sheet, `.d-${v}`, `display: ${v};`);
    });

    // float ---------------------------------------------------------------
    ['left', 'right', 'none'].map((v) => {
        createStyle(sheet, `.float-${v}`, `float: ${v};`);
    });

    //flex ---------------------------------------------------------------
    ['fill', 'grow', 'shrink', 'auto', 'none'].map((v) => {
        createStyle(sheet, `.flex-${v}`, `flex: ${v};`);
    });

    // flex direction
    ['row', 'column', 'row-reverse', 'column-reverse'].map((v) => {
        createStyle(sheet, `.flex-dir${v}`, `flex-direction: ${v};`);
    });

    // flex wrap
    ['nowrap', 'wrap', 'wrap-reverse'].map((v) => {
        createStyle(sheet, `.flex-wrap-${v}`, `flex-wrap: ${v};`);
    });

    // justify content
    ['start', 'end', 'center', 'between', 'around'].map((v) => {
        createStyle(sheet, `.justify-${v}`, `justify-content: ${v};`);
    });

    // align items
    ['start', 'end', 'center', 'baseline', 'stretch'].map((v) => {
        createStyle(sheet, `.align-items-${v}`, `align-items: ${v};`);
    });

    // align content
    ['start', 'end', 'center', 'between', 'around', 'stretch'].map((v) => {
        createStyle(sheet, `.align-content-${v}`, `align-content: ${v};`);
    });

    // align self
    ['start', 'end', 'center', 'baseline', 'stretch'].map((v) => {
        createStyle(sheet, `.align-self-${v}`, `align-self: ${v};`);
    });
    // Grid ---------------------------------------------------------------
    // grid template columns
    ['none', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map((v) => {
        createStyle(sheet, `.grid-cols-${v}`, `grid-template-columns: repeat(${v}, 1fr);`);
    });

    // grid container
    ['auto', 'min', 'max', 'fit', 'full'].map((v) => {
        createStyle(sheet, `.grid-container-${v}`, `grid-template-columns: ${v};`);
    });

    // grid item
    ['auto', 'min', 'max', 'fit', 'full'].map((v) => {
        createStyle(sheet, `.grid-item-${v}`, `grid-column: ${v};`);
    });

    //gap 
    Object.entries(spacingByRem).map(([key, value]) => {
        createStyle(sheet, `.gap-${key}`, `gap: ${value}rem;`);
    });

    //gap px
    [...Array(24).keys()].map((key) => {
        createStyle(sheet, `.gap-${key}px`, `gap: ${key}px;`);
    });

    // Box shadow ---------------------------------------------------------------
    Object.entries(spacingByRem).map(([key, value]) => {
        createStyle(sheet, `.box-shadow-${key}`, `box-shadow: 0 0 ${value}rem rgba(0, 0, 0, 0.2);`);
    });
    Object.entries(relativeScales).map(([key, value]) => {
        createStyle(sheet, `.box-shadow-${key}`, `box-shadow: 0 0 ${value}rem rgba(0, 0, 0, 0.2);`);
    });
    //sizing ---------------------------------------------------------------
    //resize
    ['none', 'both', 'horizontal', 'vertical'].map((v) => {
        createStyle(sheet, `.resize-${v}`, `resize: ${v};`);
    });

    //width
    Object.entries(spacingByRem).map(([key, value]) => {
        createStyle(sheet, `.w-${key}`, `width: ${value}rem;`);
    });

    //height
    Object.entries(spacingByRem).map(([key, value]) => {
        createStyle(sheet, `.h-${key}`, `height: ${value}rem;`);
    });

    //min-width
    Object.entries(spacingByRem).map(([key, value]) => {
        createStyle(sheet, `.min-w-${key}`, `min-width: ${value}rem;`);
    });

    //min-height
    Object.entries(spacingByRem).map(([key, value]) => {
        createStyle(sheet, `.min-h-${key}`, `min-height: ${value}rem;`);
    });

    //max-width
    Object.entries(spacingByRem).map(([key, value]) => {
        createStyle(sheet, `.max-w-${key}`, `max-width: ${value}rem;`);
    });

    //max-height
    Object.entries(spacingByRem).map(([key, value]) => {
        createStyle(sheet, `.max-h-${key}`, `max-height: ${value}rem;`);
    });
}

// change styles defined in the sheet
export function changeStyle(sheet, styleSelector, styleDesc) {
    sheet.cssRules.map((rule) => {
        if (rule.selectorText === styleSelector) {
            rule.style.cssText = styleDesc;
        }
    });
}

// Named styles --------------------------------------------------------------
export function createNamedStyle(styleJson, sheet) {
    const styleName = `style-${styleJson.name || createUUID()}`;
    sheet = sheet || $up.globalStylesheets[0];
    const styleDesc = Object.entries(styleJson).map(([key, value]) => {
        const hypenKey = key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
        const styleRule = `${hypenKey}: ${value};`;
        return styleRule;
    }).join('');

    sheet.insertRule(`.${styleName} { ${styleDesc} }`);
    return { styleName, styleDesc };
}

// Complex styles creating support -------------------------------------------
export function createNamedGradientStyle(config, sheet) {
    const styleName = `gradient-${config.name || createUUID()}`;

    sheet = sheet || $up.globalStylesheets[0];
    const gradient = `linear-gradient(
        ${config.angle ? config.angle || 0 + 'deg ,' : ''}
        ${config.dir ? config.dir + ',' : ''}
        ${config.colors.join(',')})
        `;
    const styleDesc = `background-image: ${gradient};`;
    sheet.insertRule(`.${styleName} { ${styleDesc} }`);

    return { styleName, styleDesc };
}

export function createNamedEventStyle(config, sheet) {
    const styleName = `event-${config.name || createUUID()}`;
    const styleEvent = config.event || 'hover';

    sheet = sheet || $up.globalStylesheets[0];
    const styleDesc = Object.entries(config).map(([key, value]) => {
        if (key === 'event' || key === 'name') return;

        const hypenKey = key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
        const styleRule = `${hypenKey}: ${value};`;
        return styleRule;
    }).join('');
    const ruleStr = `.${styleName}:${styleEvent} { ${styleDesc} }`;
    // console.log(ruleStr);
    sheet.insertRule(ruleStr);

    return { styleName, ruleStr, styleDesc };
}