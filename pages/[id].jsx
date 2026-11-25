import { Fragment } from "react";
import Head from "next/head";
import { getDatabase, getPage, getBlocks } from "../lib/notion.js";
import Link from "next/link";
import { databaseId } from "./index.jsx";
import styles from "./post.module.css";

export const Text = ({ text }) => {
  if (!text) {
    return null;
  }
  return text.map((value) => {
    const {
      annotations: { bold, code, color, italic, strikethrough, underline },
      text,
    } = value;
    return (
      <span
        className={[
          bold ? styles.bold : "",
          code ? styles.code : "",
          italic ? styles.italic : "",
          strikethrough ? styles.strikethrough : "",
          underline ? styles.underline : "",
        ].join(" ")}
        style={color !== "default" ? { color } : {}}
      >
        {text.link ? <a href={text.link.url}>{text.content}</a> : text.content}
      </span>
    );
  });
};

// Notion の画像ピッカーで挿入した Unsplash の写真は、原寸（数千px・1MB超）の URL で
// 届く。Unsplash の API ガイドラインは画像を images.unsplash.com から直接表示（hotlink）
// することを求めており、自前のサーバー（next/image）で中継すると閲覧の計測が Unsplash に
// 届かなくなる。そのため中継はせず、Unsplash（imgix）自身のリサイズ用パラメータで
// 表示幅に合ったサイズを要求する。
// https://help.unsplash.com/en/articles/2511271-guideline-hotlinking-images
// https://unsplash.com/documentation#dynamically-resizable-images
const UNSPLASH_HOST = "images.unsplash.com";
const POST_IMAGE_WIDTHS = [320, 480, 660, 990, 1320];
// .container は max-width: 700px / 左右 padding 20px / border-box のため、
// 本文の画像幅は「画面幅 - 40px」で、最大 660px。
const POST_IMAGE_SIZES = "(max-width: 700px) calc(100vw - 40px), 660px";

const unsplashUrl = (url, width) => {
  const resized = new URL(url);
  // fm=jpg が残っていると auto=format（AVIF/WebP の自動選択）が効かない。
  resized.searchParams.delete("fm");
  resized.searchParams.set("auto", "format");
  // 原寸より大きい幅を指定しても拡大しない。
  resized.searchParams.set("fit", "max");
  resized.searchParams.set("w", String(width));
  return resized.toString();
};

// Unsplash の写真なら srcSet / sizes を付けた属性を返す。それ以外（Notion にアップロード
// された画像の署名付き URL など）はリサイズできないため、そのままの src を返す。
const responsiveImageProps = (src) => {
  let url;
  try {
    url = new URL(src);
  } catch {
    return { src };
  }
  // 高さや切り抜き範囲が指定済みの URL は、幅だけ変えると縦横比が崩れるので触らない。
  const hasCrop = ["h", "rect", "fit", "ar"].some((key) =>
    url.searchParams.has(key)
  );
  if (url.hostname !== UNSPLASH_HOST || hasCrop) {
    return { src };
  }
  return {
    src: unsplashUrl(src, 660),
    srcSet: POST_IMAGE_WIDTHS.map((w) => `${unsplashUrl(src, w)} ${w}w`).join(", "),
    sizes: POST_IMAGE_SIZES,
  };
};

const renderNestedList = (block) => {
  const { type } = block;
  const value = block[type];
  if (!value) return null;

  const isNumberedList = value.children[0].type === 'numbered_list_item';

  if (isNumberedList) {
    return (
      <ol>
        {value.children.map((childBlock) => (
          <Fragment key={childBlock.id}>{renderBlock(childBlock)}</Fragment>
        ))}
      </ol>
    );
  }
  return (
    <ul>
      {value.children.map((childBlock) => (
        <Fragment key={childBlock.id}>{renderBlock(childBlock)}</Fragment>
      ))}
    </ul>
  );
};

const renderBlock = (block) => {
  const { type, id } = block;
  const value = block[type];

  switch (type) {
    case "paragraph":
      return (
        <p>
          <Text text={value.text} />
        </p>
      );
    case "heading_1":
      return (
        <h1>
          <Text text={value.text} />
        </h1>
      );
    case "heading_2":
      return (
        <h2>
          <Text text={value.text} />
        </h2>
      );
    case "heading_3":
      return (
        <h3>
          <Text text={value.text} />
        </h3>
      );
    case "bulleted_list_item":
    case "numbered_list_item":
      return (
        <li>
          <Text text={value.text} />
          {!!value.children && renderNestedList(block)}
        </li>
      );
    case "to_do":
      return (
        <div>
          <label htmlFor={id}>
            <input type="checkbox" id={id} defaultChecked={value.checked} />{" "}
            <Text text={value.text} />
          </label>
        </div>
      );
    case "toggle":
      return (
        <details>
          <summary>
            <Text text={value.text} />
          </summary>
          {value.children?.map((block) => (
            <Fragment key={block.id}>{renderBlock(block)}</Fragment>
          ))}
        </details>
      );
    case "child_page":
      return <p>{value.title}</p>;
    case "image":
      const src =
        value.type === "external" ? value.external.url : value.file.url;
      const caption = value.caption ? value.caption[0]?.plain_text : "";
      return (
        <figure>
          <img {...responsiveImageProps(src)} alt={caption} />
          {caption && <figcaption>{caption}</figcaption>}
        </figure>
      );
    case "divider":
      return <hr key={id} />;
    case "quote":
      return <blockquote key={id}>{value.text[0].plain_text}</blockquote>;
    case "code":
      return (
        <pre className={styles.pre}>
          <code className={styles.code_block} key={id}>
            {value.text[0].plain_text}
          </code>
        </pre>
      );
    case "file":
      const src_file =
        value.type === "external" ? value.external.url : value.file.url;
      const splitSourceArray = src_file.split("/");
      const lastElementInArray = splitSourceArray[splitSourceArray.length - 1];
      const caption_file = value.caption ? value.caption[0]?.plain_text : "";
      return (
        <figure>
          <div className={styles.file}>
            📎{" "}
            <Link href={src_file} passHref>
              {lastElementInArray.split("?")[0]}
            </Link>
          </div>
          {caption_file && <figcaption>{caption_file}</figcaption>}
        </figure>
      );
    case "bookmark":
      const href = value.url
      return (
        <a href={ href } target="_brank" className={styles.bookmark}>
          { href }
        </a>
      );
    default:
      return `❌ Unsupported block (${
        type === "unsupported" ? "unsupported by Notion API" : type
      })`;
  }
};

export default function Post({ page, blocks }) {
  if (!page || !blocks) {
    return <div />;
  }
  return (
    <div>
      <Head>
        <title>{page.properties.Name.title[0].plain_text}</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <article className={styles.container}>
        <h1 className={styles.name}>
          <Text text={page.properties.Name.title} />
        </h1>
        <section>
          {blocks.map((block) => (
            <Fragment key={block.id}>{renderBlock(block)}</Fragment>
          ))}
          <Link href="/">
            <a className={styles.back}>← Go home</a>
          </Link>
        </section>
      </article>
    </div>
  );
}

export const getStaticPaths = async () => {
  const database = await getDatabase(databaseId);
  return {
    paths: database.map((page) => ({ params: { id: page.id } })),
    fallback: true,
  };
};

export const getStaticProps = async (context) => {
  const { id } = context.params;
  const page = await getPage(id);
  const blocks = await getBlocks(id);

  // Retrieve block children for nested blocks (one level deep), for example toggle blocks
  // https://developers.notion.com/docs/working-with-page-content#reading-nested-blocks
  const childBlocks = await Promise.all(
    blocks
      .filter((block) => block.has_children)
      .map(async (block) => {
        return {
          id: block.id,
          children: await getBlocks(block.id),
        };
      })
  );
  const blocksWithChildren = blocks.map((block) => {
    // Add child blocks if the block should contain children but none exists
    if (block.has_children && !block[block.type].children) {
      block[block.type]["children"] = childBlocks.find(
        (x) => x.id === block.id
      )?.children;
    }
    return block;
  });

  return {
    props: {
      page,
      blocks: blocksWithChildren,
    },
    revalidate: 10, //ISR...前回から何秒以内のアクセスを無視するか指定します。
  };
};
