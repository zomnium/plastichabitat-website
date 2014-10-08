<?php

/**
 * Zomnium File
 * Get's the filepath and modification date from the current request and makes it available for the theme.
 *
 * @author Zomnium, Tim van Bergenhenegouwen
 * @link http://zomnium.com
 */
class Zomnium_File {

    private $filepath;

    /**
     * Modified
     * Get readable modified date from filepath.
     * filter
     */
    private function modified($filepath)
    {
        if ( ! file_exists($filepath))
        {
            return 'unknown';
        }
        return date( "F d - Y, H:i:s",
                filemtime($filepath)
            );
    }

    /**
     * Before load content
     * Get filepath from current request.
     * hook
     */
    public function before_load_content(&$file)
    {
        $this->filepath = $file;
    }

    /**
     * Before render
     * Add generated meta to twig variables.
     * hook
     */
    public function before_render(&$twig_vars, &$twig, &$template)
    {
        if (!isset($twig_vars['z_file']))
        {
            $twig_vars['z_file']['filepath'] = $this->filepath;
            $twig_vars['z_file']['modified'] = $this->modified($this->filepath);
        }
    }

}
